// Playbook (strategy) analytics: R distribution and per-rule adherence.

import type { Rule } from "./strategies";

export const R_BUCKETS = [
  { key: "lt-2", label: "≤ −2R", min: -Infinity, max: -2 },
  { key: "-2", label: "−2 to −1R", min: -2, max: -1 },
  { key: "-1", label: "−1 to 0R", min: -1, max: 0 },
  { key: "0", label: "0 to 1R", min: 0, max: 1 },
  { key: "1", label: "1 to 2R", min: 1, max: 2 },
  { key: "2", label: "2 to 3R", min: 2, max: 3 },
  { key: "gt3", label: "≥ 3R", min: 3, max: Infinity },
] as const;

/**
 * Histogram of R-multiples. Buckets are [min, max) except the last, so exactly 0R
 * lands in "0 to 1R" and exactly −2R in "−2 to −1R". Trades without R are counted separately.
 */
export function rDistribution(rs: (number | null)[]) {
  const valid = rs.filter((r): r is number => r != null);
  const buckets = R_BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const r of valid) {
    const i = buckets.findIndex((b) => r >= b.min && r < b.max);
    buckets[i === -1 ? buckets.length - 1 : i].count++;
  }
  return {
    buckets,
    withR: valid.length,
    withoutR: rs.length - valid.length,
    avgR: valid.length ? valid.reduce((s, r) => s + r, 0) / valid.length : null,
  };
}

export type RuleAdherence = {
  rule: Rule;
  group: "Entry" | "Exit" | "Risk";
  /** Trades whose checklist was filled in. */
  reviewed: number;
  followed: number;
  followedPct: number | null;
  /** Win rate when the rule was followed vs broken; null if no trades on that side. */
  winRateFollowed: number | null;
  winRateBroken: number | null;
};

/** How often each rule was ticked, and how results differ when it was. */
export function ruleAdherence(
  rules: { entry: Rule[]; exit: Rule[]; risk: Rule[] },
  trades: { netPnl: number; checkedRules: string[] | null }[],
): RuleAdherence[] {
  const reviewed = trades.filter((t): t is { netPnl: number; checkedRules: string[] } => t.checkedRules != null);
  const wr = (ts: { netPnl: number }[]) => (ts.length ? (ts.filter((t) => t.netPnl > 0).length / ts.length) * 100 : null);
  const all = [
    ...rules.entry.map((rule) => ({ rule, group: "Entry" as const })),
    ...rules.exit.map((rule) => ({ rule, group: "Exit" as const })),
    ...rules.risk.map((rule) => ({ rule, group: "Risk" as const })),
  ];
  return all.map(({ rule, group }) => {
    const yes = reviewed.filter((t) => t.checkedRules.includes(rule.id));
    const no = reviewed.filter((t) => !t.checkedRules.includes(rule.id));
    return {
      rule,
      group,
      reviewed: reviewed.length,
      followed: yes.length,
      followedPct: reviewed.length ? (yes.length / reviewed.length) * 100 : null,
      winRateFollowed: wr(yes),
      winRateBroken: wr(no),
    };
  });
}

/** New stable id for a rule, unique within a strategy. */
export function newRuleId(prefix: "e" | "x" | "r", existing: string[]): string {
  let n = existing.length + 1;
  while (existing.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}
