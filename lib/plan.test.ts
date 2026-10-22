import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { comparePlan } from "./plan";

const t = (netPnl: number, time: string, strategyId: string | null, followedPlan: boolean | null = null) => ({
  entryAt: fromIST("2026-10-12", time),
  netPnl,
  strategyId,
  followedPlan,
});

describe("comparePlan", () => {
  it("checks count, loss, strategies and self-review", () => {
    const res = comparePlan(
      { planMaxTrades: 2, planMaxLoss: 3000, planStrategyIds: ["orb"] },
      [t(-2000, "09:20", "orb", true), t(-1500, "09:50", null, false), t(4000, "10:30", "vwap", false)],
      { vwap: "VWAP" },
    );
    const by = Object.fromEntries(res.map((c) => [c.key, c]));
    assert.equal(by.trades.ok, false);
    assert.equal(by.loss.ok, false); // running −3,500 at worst
    assert.match(by.loss.detail, /3,500/);
    assert.equal(by.strategies.ok, false);
    assert.match(by.strategies.detail, /no strategy, VWAP/);
    assert.match(by.selfReport.detail, /2 of 3/);
  });

  it("skips checks the plan didn't set", () => {
    assert.deepEqual(comparePlan({ planMaxTrades: null, planMaxLoss: null, planStrategyIds: [] }, [t(100, "09:20", null)]), []);
  });
});

describe("comparePlan loss wording", () => {
  it("says the day never went red instead of printing -0", () => {
    const [c] = comparePlan({ planMaxTrades: null, planMaxLoss: 4000, planStrategyIds: [] }, [t(500, "09:20", null)]);
    assert.equal(c.detail, "never went into a loss (limit ₹4,000)");
  });
});
