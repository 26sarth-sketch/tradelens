// Builds a complete Trade row (P&L, charges, R, expiry flag, display symbol) from raw
// fields. Shared by manual entry, CSV import and the seed script so all three agree.

import type { BrokeragePlanKey } from "@/config/market";
import { computeTradePnl, round2 } from "./charges";
import { isExpiryDay } from "./expiry";
import { formatNumber } from "./format";
import type { Direction, Exchange, OptionType, Segment } from "./types";

export type RawTrade = {
  exchange: Exchange;
  segment: Segment;
  underlying: string;
  optionType?: OptionType | null;
  strike?: number | null;
  expiry?: Date | null;
  lotSize?: number | null;
  direction: Direction;
  qty: number;
  avgEntry: number;
  avgExit: number;
  entryAt: Date;
  exitAt: Date;
  buyOrders?: number;
  sellOrders?: number;
  plannedSL?: number | null;
  plannedTarget?: number | null;
};

/** "NIFTY 24500 CE 27 Oct", "BANKNIFTY FUT 27 Oct", "RELIANCE" */
export function displaySymbol(t: Pick<RawTrade, "segment" | "underlying" | "optionType" | "strike" | "expiry">) {
  const u = t.underlying.toUpperCase();
  const exp = t.expiry
    ? ` ${t.expiry.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}`
    : "";
  if (t.segment === "OPT") return `${u} ${formatNumber(t.strike ?? 0).replace(/,/g, "")} ${t.optionType ?? ""}${exp}`.trim();
  if (t.segment === "FUT") return `${u} FUT${exp}`;
  return u;
}

/**
 * Planned R (reward:risk) from stop-loss and target, and the realised R-multiple
 * (net P&L ÷ ₹ risked). Both null when no stop-loss was set.
 */
export function computeR(t: Pick<RawTrade, "avgEntry" | "qty" | "plannedSL" | "plannedTarget">, netPnl: number) {
  if (t.plannedSL == null) return { plannedR: null, rMultiple: null };
  const riskPerUnit = Math.abs(t.avgEntry - t.plannedSL);
  if (riskPerUnit === 0) return { plannedR: null, rMultiple: null };
  const plannedR = t.plannedTarget != null ? round2(Math.abs(t.plannedTarget - t.avgEntry) / riskPerUnit) : null;
  const rMultiple = round2(netPnl / (riskPerUnit * t.qty));
  return { plannedR, rMultiple };
}

export function buildTradeData(t: RawTrade, plan?: BrokeragePlanKey) {
  const pnl = computeTradePnl({
    exchange: t.exchange,
    segment: t.segment,
    direction: t.direction,
    qty: t.qty,
    avgEntry: t.avgEntry,
    avgExit: t.avgExit,
    buyOrders: t.buyOrders,
    sellOrders: t.sellOrders,
    plan,
  });
  const isFno = t.segment === "OPT" || t.segment === "FUT";
  const lotSize = isFno ? (t.lotSize ?? null) : null;

  return {
    exchange: t.exchange,
    segment: t.segment,
    symbol: displaySymbol(t),
    underlying: t.underlying.toUpperCase(),
    optionType: t.segment === "OPT" ? (t.optionType ?? null) : null,
    strike: t.segment === "OPT" ? (t.strike ?? null) : null,
    expiry: isFno ? (t.expiry ?? null) : null,
    lotSize,
    lots: lotSize ? round2(t.qty / lotSize) : null,
    direction: t.direction,
    qty: t.qty,
    avgEntry: t.avgEntry,
    avgExit: t.avgExit,
    entryAt: t.entryAt,
    exitAt: t.exitAt,
    buyOrders: t.buyOrders ?? 1,
    sellOrders: t.sellOrders ?? 1,
    grossPnl: pnl.grossPnl,
    brokerage: pnl.brokerage,
    stt: pnl.stt,
    exchangeTxn: pnl.exchangeTxn,
    sebiFee: pnl.sebiFee,
    stampDuty: pnl.stampDuty,
    gst: pnl.gst,
    otherCharges: pnl.otherCharges,
    totalCharges: pnl.totalCharges,
    netPnl: pnl.netPnl,
    points: pnl.points,
    isExpiryDay: isFno && isExpiryDay(t.underlying, t.entryAt),
    plannedSL: t.plannedSL ?? null,
    plannedTarget: t.plannedTarget ?? null,
    ...computeR(t, pnl.netPnl),
  };
}

/**
 * Max favourable / adverse excursion from the manually entered high and low during
 * the trade, in ₹ (gross, per the whole position):
 *   MFE  = best open profit you were ever sitting on
 *   MAE  = worst open loss you sat through
 *   left = extra you'd have made exiting at the best price instead of your exit
 * Null when high/low weren't entered.
 */
export function excursions(t: {
  direction: string;
  qty: number;
  avgEntry: number;
  avgExit: number;
  highPrice: number | null;
  lowPrice: number | null;
}) {
  if (t.highPrice == null || t.lowPrice == null) return null;
  const long = t.direction === "LONG";
  const best = long ? t.highPrice : t.lowPrice;
  const worst = long ? t.lowPrice : t.highPrice;
  const sign = long ? 1 : -1;
  const mfe = Math.max(0, (best - t.avgEntry) * sign * t.qty);
  const mae = Math.max(0, (t.avgEntry - worst) * sign * t.qty);
  const leftOnTable = Math.max(0, (best - t.avgExit) * sign * t.qty);
  // Share of the best available move you captured (null if there was no favourable move).
  const captured = mfe > 0 ? ((t.avgExit - t.avgEntry) * sign * t.qty) / mfe : null;
  return {
    bestPrice: best,
    mfe: round2(mfe),
    mae: round2(mae),
    leftOnTable: round2(leftOnTable),
    capturedPct: captured == null ? null : Math.round(captured * 100),
  };
}
