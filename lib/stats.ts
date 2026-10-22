// Stats engine: pure functions over trades. Used by the dashboard, reports, the
// Lens Score and the AI coach (which is only ever given numbers computed here).
//
// Every stat can be computed in one of four units ("views"):
//   inr    → net P&L in ₹ (after charges)
//   pct    → net P&L as % of the trader's capital
//   r      → R-multiple (only trades with a stop-loss have one)
//   points → per-unit price move, index underlyings only (NIFTY, BANKNIFTY…)
// A trade is a win when its value in the chosen unit is > 0.

import { isIndex } from "./expiry";
import { istDateKey } from "./format";

export const VIEWS = ["inr", "pct", "r", "points"] as const;
export type View = (typeof VIEWS)[number];

export const VIEW_LABELS: Record<View, string> = { inr: "₹", pct: "% of capital", r: "R-multiple", points: "Points" };

/** The fields stats need; Prisma Trade rows satisfy this. */
export type StatTrade = {
  entryAt: Date;
  exitAt: Date;
  netPnl: number;
  grossPnl: number;
  totalCharges: number;
  rMultiple: number | null;
  points: number | null;
  underlying: string;
};

export type Stats = {
  view: View;
  /** Trades that have a value in this view (R needs a stop-loss, points needs an index). */
  count: number;
  /** All trades considered, before the view's filter. */
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100
  net: number; // in view units
  avgWin: number; // ≥ 0
  avgLoss: number; // ≥ 0 (magnitude)
  /** avgWin ÷ avgLoss; null if there are no losses. */
  winLossRatio: number | null;
  /** Sum of wins ÷ |sum of losses|; null if there are no losses. */
  profitFactor: number | null;
  /** Average result per trade = winRate × avgWin − lossRate × avgLoss. */
  expectancy: number;
  /** Largest peak-to-trough fall of the cumulative curve, in view units (≥ 0). */
  maxDrawdown: number;
  /** Max drawdown as % of the account at its peak (₹ view only; capital + profits). */
  maxDrawdownPct: number | null;
  // Always in ₹, whatever the view:
  grossPnl: number;
  totalCharges: number;
  netPnl: number;
  /** Charges as % of gross profit; null when gross ≤ 0. */
  chargesPctOfGross: number | null;
};

/** A trade's value in a view, or null if it has none (no stop-loss / not an index). */
export function valueIn(view: View, t: StatTrade, capital: number): number | null {
  switch (view) {
    case "inr":
      return t.netPnl;
    case "pct":
      return capital > 0 ? (t.netPnl / capital) * 100 : null;
    case "r":
      return t.rMultiple;
    case "points":
      return isIndex(t.underlying) ? t.points : null;
  }
}

const byExit = (a: StatTrade, b: StatTrade) => a.exitAt.getTime() - b.exitAt.getTime();

/** Max peak-to-trough fall of a running sum that starts at `start`. */
export function maxDrawdown(values: number[], start = 0): { amount: number; pctOfPeak: number | null } {
  let equity = start;
  let peak = start;
  let worst = 0;
  let worstPeak = start;
  for (const v of values) {
    equity += v;
    if (equity > peak) peak = equity;
    if (peak - equity > worst) {
      worst = peak - equity;
      worstPeak = peak;
    }
  }
  return { amount: worst, pctOfPeak: worstPeak > 0 ? (worst / worstPeak) * 100 : null };
}

export function computeStats(trades: StatTrade[], opts: { view?: View; capital?: number } = {}): Stats {
  const view = opts.view ?? "inr";
  const capital = opts.capital ?? 0;
  const sorted = [...trades].sort(byExit);
  const vals = sorted.map((t) => valueIn(view, t, capital)).filter((v): v is number => v != null);

  const winVals = vals.filter((v) => v > 0);
  const lossVals = vals.filter((v) => v <= 0);
  const sumWins = winVals.reduce((s, v) => s + v, 0);
  const sumLosses = Math.abs(lossVals.reduce((s, v) => s + v, 0));
  const count = vals.length;
  const avgWin = winVals.length ? sumWins / winVals.length : 0;
  const avgLoss = lossVals.length ? sumLosses / lossVals.length : 0;
  const net = vals.reduce((s, v) => s + v, 0);

  // ₹ drawdown is measured on the account (capital + running P&L) so it can be a %.
  const dd = maxDrawdown(vals, view === "inr" ? capital : 0);

  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const totalCharges = trades.reduce((s, t) => s + t.totalCharges, 0);

  return {
    view,
    count,
    totalTrades: trades.length,
    wins: winVals.length,
    losses: lossVals.length,
    winRate: count ? (winVals.length / count) * 100 : 0,
    net,
    avgWin,
    avgLoss,
    winLossRatio: avgLoss > 0 ? avgWin / avgLoss : null,
    profitFactor: sumLosses > 0 ? sumWins / sumLosses : null,
    expectancy: count ? net / count : 0,
    maxDrawdown: dd.amount,
    maxDrawdownPct: view === "inr" && capital > 0 ? dd.pctOfPeak : null,
    grossPnl,
    totalCharges,
    netPnl: trades.reduce((s, t) => s + t.netPnl, 0),
    chargesPctOfGross: grossPnl > 0 ? (totalCharges / grossPnl) * 100 : null,
  };
}

// ─── Time series ──────────────────────────────────────────────────────────────

export type DayStat = {
  date: string; // IST day key
  trades: number;
  /** Trades that have a value in this view (e.g. a stop-loss for R). */
  valued: number;
  wins: number;
  value: number; // net in view units
  netPnl: number; // ₹
  grossPnl: number;
  totalCharges: number;
};

/** Per IST trading day (by exit time), in date order. */
export function dailyStats(trades: StatTrade[], opts: { view?: View; capital?: number } = {}): DayStat[] {
  const view = opts.view ?? "inr";
  const days = new Map<string, DayStat>();
  for (const t of trades) {
    const date = istDateKey(t.exitAt);
    const d = days.get(date) ?? { date, trades: 0, valued: 0, wins: 0, value: 0, netPnl: 0, grossPnl: 0, totalCharges: 0 };
    const v = valueIn(view, t, opts.capital ?? 0);
    d.trades++;
    if (t.netPnl > 0) d.wins++;
    if (v != null) {
      d.valued++;
      d.value += v;
    }
    d.netPnl += t.netPnl;
    d.grossPnl += t.grossPnl;
    d.totalCharges += t.totalCharges;
    days.set(date, d);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type EquityPoint = { date: string; value: number; cumulative: number; drawdown: number };

/** Cumulative curve by day, with the running drawdown from the previous peak. */
export function equityCurve(days: DayStat[]): EquityPoint[] {
  let cum = 0;
  let peak = 0;
  return days.map((d) => {
    cum += d.value;
    peak = Math.max(peak, cum);
    return { date: d.date, value: d.value, cumulative: cum, drawdown: cum - peak };
  });
}
