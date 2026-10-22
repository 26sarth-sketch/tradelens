// Compare report: two filtered sets of trades, side by side.

import type { TradeFilter } from "./filters";
import { computeStats, type Stats, type StatTrade } from "./stats";

export type ComparePreset = { key: string; label: string; a: { name: string; filter: TradeFilter }; b: { name: string; filter: TradeFilter } };

/** One-click questions a trader actually asks. A is the "disciplined" side where there is one. */
export const COMPARE_PRESETS: ComparePreset[] = [
  {
    key: "plan",
    label: "Followed plan vs broke plan",
    a: { name: "Followed my plan", filter: { plan: "followed" } },
    b: { name: "Broke my plan", filter: { plan: "broke" } },
  },
  {
    key: "expiry",
    label: "Normal days vs expiry days",
    a: { name: "Non-expiry days", filter: { expiry: "no" } },
    b: { name: "Expiry days", filter: { expiry: "yes" } },
  },
  {
    key: "time",
    label: "Before 2 PM vs after 2 PM",
    a: { name: "Before 2 PM", filter: { timeTo: "14:00" } },
    b: { name: "After 2 PM", filter: { timeFrom: "14:00" } },
  },
  {
    key: "emotion",
    label: "Calm vs revenge/FOMO",
    a: { name: "Calm or confident", filter: { emotions: ["Calm", "Confident"] } },
    b: { name: "Revenge or FOMO", filter: { emotions: ["Revenge", "FOMO"] } },
  },
  {
    key: "stoploss",
    label: "With stop-loss vs without",
    a: { name: "Had a stop-loss", filter: { stopLoss: "yes" } },
    b: { name: "No stop-loss", filter: { stopLoss: "no" } },
  },
  {
    key: "direction",
    label: "Longs vs shorts",
    a: { name: "Long trades", filter: { direction: "LONG" } },
    b: { name: "Short trades", filter: { direction: "SHORT" } },
  },
];

export type MetricRow = {
  label: string;
  a: number | null;
  b: number | null;
  format: "inr" | "pct" | "ratio" | "count" | "r";
  /** Which direction is better; null = neither (e.g. trade count). */
  better: "higher" | "lower" | null;
  winner: "a" | "b" | null;
};

const avgR = (ts: StatTrade[]) => {
  const rs = ts.map((t) => t.rMultiple).filter((r): r is number => r != null);
  return rs.length ? rs.reduce((s, r) => s + r, 0) / rs.length : null;
};

export function compareMetrics(a: StatTrade[], b: StatTrade[], capital?: number): { sa: Stats; sb: Stats; rows: MetricRow[] } {
  const sa = computeStats(a, { capital });
  const sb = computeStats(b, { capital });
  const defs: Omit<MetricRow, "winner">[] = [
    { label: "Trades", a: sa.count, b: sb.count, format: "count", better: null },
    { label: "Win rate", a: sa.winRate, b: sb.winRate, format: "pct", better: "higher" },
    { label: "Net P&L", a: sa.net, b: sb.net, format: "inr", better: "higher" },
    { label: "Avg per trade (expectancy)", a: sa.expectancy, b: sb.expectancy, format: "inr", better: "higher" },
    { label: "Profit factor", a: sa.profitFactor, b: sb.profitFactor, format: "ratio", better: "higher" },
    { label: "Average win", a: sa.avgWin, b: sb.avgWin, format: "inr", better: "higher" },
    { label: "Average loss", a: sa.avgLoss, b: sb.avgLoss, format: "inr", better: "lower" },
    { label: "Max drawdown", a: sa.maxDrawdown, b: sb.maxDrawdown, format: "inr", better: "lower" },
    { label: "Average R (trades with a stop-loss)", a: avgR(a), b: avgR(b), format: "r", better: "higher" },
    { label: "Charges paid", a: sa.totalCharges, b: sb.totalCharges, format: "inr", better: null },
    { label: "Charges as % of gross profit", a: sa.chargesPctOfGross, b: sb.chargesPctOfGross, format: "pct", better: "lower" },
  ];
  const rows = defs.map((d) => {
    let winner: MetricRow["winner"] = null;
    if (d.better && d.a != null && d.b != null && d.a !== d.b && sa.count > 0 && sb.count > 0) {
      winner = (d.better === "higher" ? d.a > d.b : d.a < d.b) ? "a" : "b";
    }
    return { ...d, winner };
  });
  return { sa, sb, rows };
}

/** Cumulative net P&L by trade number for each set (trade 1, 2, 3…), for one shared x-axis. */
export function cumulativeByTrade(a: StatTrade[], b: StatTrade[]) {
  const cum = (ts: StatTrade[]) => {
    let s = 0;
    return [...ts].sort((x, y) => x.exitAt.getTime() - y.exitAt.getTime()).map((t) => (s += t.netPnl));
  };
  const ca = cum(a);
  const cb = cum(b);
  return Array.from({ length: Math.max(ca.length, cb.length) }, (_, i) => ({ n: i + 1, a: ca[i] ?? null, b: cb[i] ?? null }));
}
