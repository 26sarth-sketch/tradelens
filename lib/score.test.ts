import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lensScore, SCORE_WEIGHTS } from "./score";
import type { DayStat, Stats } from "./stats";

const stats = (o: Partial<Stats> = {}): Stats => ({
  view: "inr",
  count: 50,
  totalTrades: 50,
  wins: 25,
  losses: 25,
  winRate: 50,
  net: 10000,
  avgWin: 1500,
  avgLoss: 1000,
  winLossRatio: 1.5,
  profitFactor: 1.5,
  expectancy: 200,
  maxDrawdown: 10000,
  maxDrawdownPct: 10,
  grossPnl: 15000,
  totalCharges: 5000,
  netPnl: 10000,
  chargesPctOfGross: 33,
  ...o,
});
const days = (green: number, red: number): DayStat[] => [
  ...Array.from({ length: green }, (_, i) => ({ date: `g${i}`, trades: 1, valued: 1, wins: 1, value: 100, netPnl: 100, grossPnl: 100, totalCharges: 0 })),
  ...Array.from({ length: red }, (_, i) => ({ date: `r${i}`, trades: 1, valued: 1, wins: 0, value: -100, netPnl: -100, grossPnl: -100, totalCharges: 0 })),
];

describe("lensScore", () => {
  it("weights sum to 1", () => {
    assert.equal(Math.round(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0) * 1000), 1000);
  });

  it("hand-worked middle-of-the-road trader", () => {
    // win 50% → 50 · PF 1.5 → 50 · W/L 1.5 → 66.7 · DD 10% → 50 · green 50% → 50
    // adherence: followed 60%, clean days 80% → 70
    // total = .15×50 + .2×50 + .15×66.67 + .15×50 + .15×50 + .2×70 = 56.5 → 57
    const s = lensScore({ stats: stats(), days: days(5, 5), reviewed: { followed: 30, total: 50 }, breachDays: 2 })!;
    assert.equal(s.total, 57);
    assert.equal(s.grade, "Developing");
    assert.deepEqual(s.components.map((c) => c.score), [50, 50, 67, 50, 50, 70]);
  });

  it("clamps to 0–100 and handles 'no losses'", () => {
    const s = lensScore({
      stats: stats({ winRate: 95, profitFactor: null, winLossRatio: null, maxDrawdownPct: 0 }),
      days: days(10, 0),
      reviewed: { followed: 10, total: 10 },
      breachDays: 0,
    })!;
    assert.equal(s.total, 100);
  });

  it("adherence uses rule-clean days alone when nothing was reviewed", () => {
    const s = lensScore({ stats: stats(), days: days(5, 5), reviewed: { followed: 0, total: 0 }, breachDays: 5 })!;
    assert.equal(s.components.find((c) => c.key === "adherence")!.score, 50);
  });

  it("needs at least 10 trades", () => {
    assert.equal(lensScore({ stats: stats({ count: 9 }), days: days(5, 4), reviewed: { followed: 0, total: 0 }, breachDays: 0 }), null);
  });
});
