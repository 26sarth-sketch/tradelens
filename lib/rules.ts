// Risk rules engine (our version of a prop-firm rule tracker).
//
// Rules (any can be off = null):
//   DAILY_LOSS      the day's running net P&L must not fall below −maxDailyLoss
//   TRADE_COUNT     at most maxTradesPerDay trades per day (each extra trade is a breach)
//   PER_TRADE_LOSS  no single trade may lose more than maxLossPerTrade (net)
//   CONSEC_LOSSES   after maxConsecutiveLosses losses in a row, stop for the day
//                   (every trade entered after that is a breach)
//   TIME_CUTOFF     no new trades at or after noTradeAfter (IST "HH:MM")
// All evaluation is per IST trading day, trades in entry order. Pure functions.

import { istDateKey, istMinutes } from "./format";
import type { RiskRule } from "./types";

export type RiskLimits = {
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  maxLossPerTrade: number | null;
  maxConsecutiveLosses: number | null;
  noTradeAfter: string | null;
};

export type RuleTrade = { id: string; entryAt: Date; exitAt: Date; netPnl: number };

export type Breach = { date: string; rule: RiskRule; value: number; limit: number; tradeId: string | null };

export const RULE_LABELS: Record<RiskRule, string> = {
  DAILY_LOSS: "Max daily loss",
  TRADE_COUNT: "Max trades per day",
  PER_TRADE_LOSS: "Max loss per trade",
  CONSEC_LOSSES: "Stop after losses in a row",
  TIME_CUTOFF: "No new trades after",
};

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const byEntry = (a: RuleTrade, b: RuleTrade) => a.entryAt.getTime() - b.entryAt.getTime();

/** Breaches for one day's trades (all from the same IST day). */
export function evaluateDay(date: string, dayTrades: RuleTrade[], r: RiskLimits): Breach[] {
  const ts = [...dayTrades].sort(byEntry);
  const out: Breach[] = [];

  if (r.maxTradesPerDay != null) {
    ts.slice(r.maxTradesPerDay).forEach((t, i) =>
      out.push({ date, rule: "TRADE_COUNT", value: r.maxTradesPerDay! + i + 1, limit: r.maxTradesPerDay!, tradeId: t.id }),
    );
  }

  if (r.maxLossPerTrade != null) {
    for (const t of ts) {
      if (t.netPnl < -r.maxLossPerTrade) out.push({ date, rule: "PER_TRADE_LOSS", value: -t.netPnl, limit: r.maxLossPerTrade, tradeId: t.id });
    }
  }

  if (r.noTradeAfter) {
    const cutoff = toMin(r.noTradeAfter);
    for (const t of ts) {
      if (istMinutes(t.entryAt) >= cutoff) out.push({ date, rule: "TIME_CUTOFF", value: istMinutes(t.entryAt), limit: cutoff, tradeId: t.id });
    }
  }

  if (r.maxConsecutiveLosses != null) {
    let streak = 0;
    for (const t of ts) {
      if (streak >= r.maxConsecutiveLosses) {
        out.push({ date, rule: "CONSEC_LOSSES", value: streak, limit: r.maxConsecutiveLosses, tradeId: t.id });
      }
      streak = t.netPnl <= 0 ? streak + 1 : 0;
    }
  }

  if (r.maxDailyLoss != null) {
    // One breach per day: the trade that first pushed the running P&L past the limit,
    // with the deepest running loss of the day as the value.
    let cum = 0;
    let deepest = 0;
    let crossedBy: string | null = null;
    for (const t of ts) {
      cum += t.netPnl;
      deepest = Math.min(deepest, cum);
      if (crossedBy == null && cum < -r.maxDailyLoss) crossedBy = t.id;
    }
    if (crossedBy) out.push({ date, rule: "DAILY_LOSS", value: -deepest, limit: r.maxDailyLoss, tradeId: crossedBy });
  }

  return out;
}

/** Breaches across all days. Days are IST trading days by entry time. */
export function evaluateAll(trades: RuleTrade[], r: RiskLimits): Breach[] {
  const days = new Map<string, RuleTrade[]>();
  for (const t of trades) {
    const k = istDateKey(t.entryAt);
    days.set(k, [...(days.get(k) ?? []), t]);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([d, ts]) => evaluateDay(d, ts, r));
}

export type RuleStatus = {
  rule: RiskRule;
  label: string;
  /** Human text for current vs limit, e.g. "₹2,400 of ₹4,000". Built by the UI. */
  current: number;
  limit: number;
  /** 0–1+ share of the limit used (for progress bars). */
  used: number;
  state: "ok" | "warning" | "breached";
};

/** Live status of each enabled rule for one day (e.g. today), for the dashboard widget. */
export function dayStatus(dayTrades: RuleTrade[], r: RiskLimits, now?: Date): RuleStatus[] {
  const ts = [...dayTrades].sort(byEntry);
  const breached = new Set(evaluateDay("", ts, r).map((b) => b.rule));
  const out: RuleStatus[] = [];
  const push = (rule: RiskRule, current: number, limit: number) => {
    const used = limit > 0 ? current / limit : current > 0 ? 1 : 0;
    out.push({ rule, label: RULE_LABELS[rule], current, limit, used, state: breached.has(rule) ? "breached" : used >= 0.8 ? "warning" : "ok" });
  };

  if (r.maxDailyLoss != null) {
    let cum = 0;
    let deepest = 0;
    for (const t of ts) deepest = Math.min(deepest, (cum += t.netPnl));
    push("DAILY_LOSS", -deepest, r.maxDailyLoss);
  }
  if (r.maxTradesPerDay != null) push("TRADE_COUNT", ts.length, r.maxTradesPerDay);
  if (r.maxLossPerTrade != null) push("PER_TRADE_LOSS", Math.max(0, ...ts.map((t) => -t.netPnl)), r.maxLossPerTrade);
  if (r.maxConsecutiveLosses != null) {
    // Current streak at the end of the day so far.
    let streak = 0;
    for (const t of ts) streak = t.netPnl <= 0 ? streak + 1 : 0;
    push("CONSEC_LOSSES", streak, r.maxConsecutiveLosses);
  }
  if (r.noTradeAfter) {
    const cutoff = toMin(r.noTradeAfter);
    const late = ts.filter((t) => istMinutes(t.entryAt) >= cutoff).length;
    const nowMin = now ? istMinutes(now) : 0;
    out.push({
      rule: "TIME_CUTOFF",
      label: RULE_LABELS.TIME_CUTOFF,
      current: late,
      limit: cutoff,
      used: late > 0 ? 1 : nowMin >= cutoff ? 1 : 0,
      state: late > 0 ? "breached" : "ok",
    });
  }
  return out;
}
