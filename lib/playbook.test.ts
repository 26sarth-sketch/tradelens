import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newRuleId, rDistribution, ruleAdherence } from "./playbook";

describe("rDistribution", () => {
  it("buckets R-multiples with edges going up", () => {
    const d = rDistribution([-2.5, -2, -0.5, 0, 0.9, 1, 2.5, 3, 7, null]);
    assert.deepEqual(d.buckets.map((b) => b.count), [1, 1, 1, 2, 1, 1, 2]);
    assert.equal(d.withR, 9);
    assert.equal(d.withoutR, 1);
    assert.equal(Math.round(d.avgR! * 100) / 100, 1.04);
  });
  it("empty", () => {
    assert.equal(rDistribution([]).avgR, null);
  });
});

describe("ruleAdherence", () => {
  const rules = { entry: [{ id: "e1", text: "Wait for close" }], exit: [{ id: "x1", text: "Target 2R" }], risk: [] };
  it("counts followed rules among reviewed trades and splits win rate", () => {
    const res = ruleAdherence(rules, [
      { netPnl: 100, checkedRules: ["e1", "x1"] },
      { netPnl: 50, checkedRules: ["e1"] },
      { netPnl: -80, checkedRules: [] },
      { netPnl: -10, checkedRules: null }, // not reviewed: ignored
    ]);
    const e1 = res.find((r) => r.rule.id === "e1")!;
    assert.equal(e1.reviewed, 3);
    assert.equal(e1.followed, 2);
    assert.equal(Math.round(e1.followedPct!), 67);
    assert.equal(e1.winRateFollowed, 100);
    assert.equal(e1.winRateBroken, 0);
    assert.equal(res.find((r) => r.rule.id === "x1")!.group, "Exit");
  });
});

describe("newRuleId", () => {
  it("never reuses an id", () => {
    assert.equal(newRuleId("e", ["e1", "e2"]), "e3");
    assert.equal(newRuleId("e", ["e1", "e3"]), "e4");
  });
});
