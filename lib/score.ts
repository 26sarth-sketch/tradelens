// Lens Score: one 0–100 number for trading health, built from six components.
// Each component maps a stat onto 0–100 with a simple linear scale and clamps.
//
//   Component        Input                                   0 points at → 100 points at   Weight
//   Win rate         % of trades that made money after costs  30%         → 70%              15%
//   Profit factor    total wins ÷ total losses                0.5         → 2.5              20%
//   Win/loss ratio   average win ÷ average loss               0.5         → 2.0              15%
//   Drawdown         max drawdown as % of the account peak    20%+        → 0%               15%
//   Consistency      % of trading days that were green        30%         → 70%              15%
//   Plan adherence   avg of: % of reviewed trades that        0%          → 100%             20%
//                    followed the plan, and % of trading
//                    days with no risk-rule breach
//
// Lens Score = weighted average of the six, rounded. Needs at least 10 trades.
// Profit factor and win/loss ratio score 100 when there are no losing trades.
// When capital isn't known, drawdown is scored against gross profit instead.

import { SCORE_NAME } from "@/config/brand";
import { computeStats, dailyStats, type DayStat, type Stats, type StatTrade } from "./stats";

export const MIN_TRADES_FOR_SCORE = 10;

export type ScoreComponentKey = "winRate" | "profitFactor" | "winLoss" | "drawdown" | "consistency" | "adherence";

export type ScoreComponent = {
  key: ScoreComponentKey;
  label: string;
  score: number; // 0–100
  weight: number; // fractions summing to 1
  raw: string; // the input value, formatted for the tooltip
  rule: string; // how it's scaled
};

export type LensScore = { name: string; total: number; components: ScoreComponent[]; grade: string };

const clamp = (n: number) => Math.max(0, Math.min(100, n));
/** Linear map: `zeroAt` → 0, `fullAt` → 100 (works for falling scales too). */
const scale = (v: number, zeroAt: number, fullAt: number) => clamp(((v - zeroAt) / (fullAt - zeroAt)) * 100);

export const SCORE_WEIGHTS: Record<ScoreComponentKey, number> = {
  winRate: 0.15,
  profitFactor: 0.2,
  winLoss: 0.15,
  drawdown: 0.15,
  consistency: 0.15,
  adherence: 0.2,
};

export function gradeFor(total: number) {
  if (total >= 80) return "Excellent";
  if (total >= 65) return "Good";
  if (total >= 50) return "Developing";
  if (total >= 35) return "Needs work";
  return "At risk";
}

export function lensScore(input: {
  stats: Stats; // ₹ view
  days: DayStat[];
  /** Trades where the trader answered "followed my plan?" */
  reviewed: { followed: number; total: number };
  /** Trading days with at least one risk-rule breach. */
  breachDays: number;
}): LensScore | null {
  const { stats: s, days, reviewed, breachDays } = input;
  if (s.count < MIN_TRADES_FOR_SCORE || days.length === 0) return null;

  const pf = s.profitFactor;
  const wl = s.winLossRatio;
  const ddPct = s.maxDrawdownPct ?? (s.grossPnl > 0 ? (s.maxDrawdown / s.grossPnl) * 20 : 20);
  const greenPct = (days.filter((d) => d.netPnl > 0).length / days.length) * 100;
  const cleanPct = ((days.length - Math.min(breachDays, days.length)) / days.length) * 100;
  const followedPct = reviewed.total > 0 ? (reviewed.followed / reviewed.total) * 100 : null;
  const adherence = followedPct == null ? cleanPct : (followedPct + cleanPct) / 2;

  const components: ScoreComponent[] = [
    { key: "winRate", label: "Win rate", score: scale(s.winRate, 30, 70), weight: SCORE_WEIGHTS.winRate, raw: `${s.winRate.toFixed(1)}%`, rule: "30% → 0, 70% → 100" },
    { key: "profitFactor", label: "Profit factor", score: pf == null ? 100 : scale(pf, 0.5, 2.5), weight: SCORE_WEIGHTS.profitFactor, raw: pf == null ? "no losses" : pf.toFixed(2), rule: "0.5 → 0, 2.5 → 100" },
    { key: "winLoss", label: "Avg win / loss", score: wl == null ? 100 : scale(wl, 0.5, 2), weight: SCORE_WEIGHTS.winLoss, raw: wl == null ? "no losses" : `${wl.toFixed(2)} : 1`, rule: "0.5 → 0, 2.0 → 100" },
    { key: "drawdown", label: "Drawdown control", score: scale(ddPct, 20, 0), weight: SCORE_WEIGHTS.drawdown, raw: `${ddPct.toFixed(1)}% max drawdown`, rule: "20%+ → 0, 0% → 100" },
    { key: "consistency", label: "Consistency", score: scale(greenPct, 30, 70), weight: SCORE_WEIGHTS.consistency, raw: `${greenPct.toFixed(0)}% green days`, rule: "30% → 0, 70% → 100" },
    {
      key: "adherence",
      label: "Plan adherence",
      score: clamp(adherence),
      weight: SCORE_WEIGHTS.adherence,
      raw: followedPct == null ? `${cleanPct.toFixed(0)}% rule-clean days` : `${followedPct.toFixed(0)}% followed plan · ${cleanPct.toFixed(0)}% rule-clean days`,
      rule: "average of the two percentages",
    },
  ];
  const total = Math.round(components.reduce((sum, c) => sum + c.score * c.weight, 0));
  return { name: SCORE_NAME, total, components: components.map((c) => ({ ...c, score: Math.round(c.score) })), grade: gradeFor(total) };
}

/** Convenience: Lens Score for a set of trades (₹ view), given the days that had a rule breach. */
export function scoreForTrades(
  trades: (StatTrade & { followedPlan: boolean | null })[],
  breachDates: Set<string>,
  capital?: number,
): LensScore | null {
  const stats = computeStats(trades, { capital });
  const days = dailyStats(trades, { capital });
  const reviewed = trades.filter((t) => t.followedPlan != null);
  return lensScore({
    stats,
    days,
    reviewed: { followed: reviewed.filter((t) => t.followedPlan).length, total: reviewed.length },
    breachDays: days.filter((d) => breachDates.has(d.date)).length,
  });
}
