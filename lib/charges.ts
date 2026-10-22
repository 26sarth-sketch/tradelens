// Indian charges engine: turns a round-trip trade into gross P&L, a full charges
// breakdown and net P&L. Pure functions; every rate comes from config/market.ts.

import {
  BROKERAGE_PLANS,
  type BrokeragePlanKey,
  type BrokerageRule,
  DEFAULT_BROKERAGE_PLAN,
  DP_CHARGE_PER_SELL,
  EXCHANGE_TXN,
  GST_RATE,
  SEBI_FEE,
  STAMP_DUTY,
  STT,
} from "@/config/market";
import type { Direction, Exchange, Segment } from "./types";

export type ChargesInput = {
  exchange: Exchange;
  segment: Segment;
  /** Total value bought, ₹ (premium value for options). */
  buyValue: number;
  /** Total value sold, ₹. */
  sellValue: number;
  /** Executed orders on each side; brokerage is charged per order. */
  buyOrders?: number;
  sellOrders?: number;
  plan?: BrokeragePlanKey;
};

export type ChargesBreakdown = {
  brokerage: number;
  stt: number;
  exchangeTxn: number;
  sebiFee: number;
  stampDuty: number;
  gst: number;
  otherCharges: number;
  totalCharges: number;
};

/** Round to paise. The epsilon nudges float artefacts like 0.1949999 the right way. */
export const round2 = (n: number) => Math.round((n + Math.sign(n) * 1e-9) * 100) / 100;

function brokerageForSide(rule: BrokerageRule, sideValue: number, orders: number): number {
  if (sideValue <= 0 || orders <= 0) return 0;
  switch (rule.kind) {
    case "zero":
      return 0;
    case "flat":
      return rule.perOrder * orders;
    case "pctCapped": {
      // Split the side's value evenly across its orders, cap each order.
      const perOrderValue = sideValue / orders;
      return Math.min(perOrderValue * rule.pct, rule.cap) * orders;
    }
  }
}

export function computeCharges(input: ChargesInput): ChargesBreakdown {
  const { exchange, segment, buyValue, sellValue } = input;
  const buyOrders = input.buyOrders ?? 1;
  const sellOrders = input.sellOrders ?? 1;
  const plan = BROKERAGE_PLANS[input.plan ?? DEFAULT_BROKERAGE_PLAN];
  const turnover = buyValue + sellValue;

  const brokerage = round2(
    brokerageForSide(plan.rules[segment], buyValue, buyOrders) +
      brokerageForSide(plan.rules[segment], sellValue, sellOrders),
  );
  const stt = round2(buyValue * STT[segment].buy + sellValue * STT[segment].sell);
  const exchangeTxn = round2(turnover * EXCHANGE_TXN[exchange][segment]);
  const sebiFee = round2(turnover * SEBI_FEE);
  const stampDuty = round2(buyValue * STAMP_DUTY[segment]);
  const gst = round2((brokerage + exchangeTxn + sebiFee) * GST_RATE);
  const otherCharges = segment === "EQ_DELIVERY" && sellValue > 0 ? DP_CHARGE_PER_SELL : 0;

  const totalCharges = round2(brokerage + stt + exchangeTxn + sebiFee + stampDuty + gst + otherCharges);
  return { brokerage, stt, exchangeTxn, sebiFee, stampDuty, gst, otherCharges, totalCharges };
}

export type TradePnlInput = Omit<ChargesInput, "buyValue" | "sellValue"> & {
  direction: Direction;
  qty: number;
  avgEntry: number;
  avgExit: number;
};

export type TradePnl = ChargesBreakdown & {
  buyValue: number;
  sellValue: number;
  grossPnl: number;
  netPnl: number;
  /** Per-unit price move in the trade's favour (index points for index F&O). */
  points: number;
};

/** Full P&L for a round trip. Works for longs and shorts (short = sell first). */
export function computeTradePnl(t: TradePnlInput): TradePnl {
  const entryValue = t.qty * t.avgEntry;
  const exitValue = t.qty * t.avgExit;
  const buyValue = t.direction === "LONG" ? entryValue : exitValue;
  const sellValue = t.direction === "LONG" ? exitValue : entryValue;

  const charges = computeCharges({ ...t, buyValue, sellValue });
  const grossPnl = round2(sellValue - buyValue);
  const sign = t.direction === "LONG" ? 1 : -1;

  return {
    ...charges,
    buyValue: round2(buyValue),
    sellValue: round2(sellValue),
    grossPnl,
    netPnl: round2(grossPnl - charges.totalCharges),
    points: round2((t.avgExit - t.avgEntry) * sign),
  };
}

/**
 * Charges as a % of gross profit, the number that shocks beginners.
 * Returns null when gross P&L isn't positive (the % is meaningless then).
 */
export function chargesPctOfGross(totalCharges: number, grossPnl: number): number | null {
  if (grossPnl <= 0) return null;
  return (totalCharges / grossPnl) * 100;
}
