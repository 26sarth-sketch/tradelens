import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { dayStatus, evaluateAll, evaluateDay, type RiskLimits, type RuleTrade } from "./rules";

let n = 0;
const t = (netPnl: number, time: string, day = "2026-10-12"): RuleTrade => {
  const at = fromIST(day, time);
  return { id: `t${++n}`, entryAt: at, exitAt: at, netPnl };
};

const OFF: RiskLimits = { maxDailyLoss: null, maxTradesPerDay: null, maxLossPerTrade: null, maxConsecutiveLosses: null, noTradeAfter: null };

describe("evaluateDay", () => {
  const day = [t(-1500, "09:20"), t(-1200, "09:50"), t(2500, "10:30"), t(-2600, "14:10"), t(300, "14:40")];

  it("each trade beyond the daily count is a breach", () => {
    const b = evaluateDay("d", day, { ...OFF, maxTradesPerDay: 3 });
    assert.deepEqual(b.map((x) => [x.rule, x.value, x.tradeId]), [["TRADE_COUNT", 4, day[3].id], ["TRADE_COUNT", 5, day[4].id]]);
  });

  it("per-trade loss limit", () => {
    const b = evaluateDay("d", day, { ...OFF, maxLossPerTrade: 2000 });
    assert.deepEqual(b.map((x) => [x.value, x.tradeId]), [[2600, day[3].id]]);
  });

  it("time cut-off flags trades entered at or after the time", () => {
    const b = evaluateDay("d", day, { ...OFF, noTradeAfter: "14:10" });
    assert.equal(b.length, 2);
  });

  it("consecutive losses: every trade after the streak is a breach", () => {
    const b = evaluateDay("d", day, { ...OFF, maxConsecutiveLosses: 2 });
    // streak hits 2 after trade 2, so trade 3 breaks the rule; trade 3 wins and resets
    assert.deepEqual(b.map((x) => x.tradeId), [day[2].id]);
  });

  it("daily loss: one breach, at the crossing trade, with the deepest loss", () => {
    // running: -1500, -2700, -200, -2800, -2500
    const b = evaluateDay("d", day, { ...OFF, maxDailyLoss: 2500 });
    assert.equal(b.length, 1);
    assert.equal(b[0].tradeId, day[1].id);
    assert.equal(b[0].value, 2800);
  });

  it("no rules → no breaches", () => {
    assert.equal(evaluateDay("d", day, OFF).length, 0);
  });
});

describe("evaluateAll", () => {
  it("evaluates each IST day separately", () => {
    const ts = [t(-1, "09:20", "2026-10-12"), t(-1, "09:30", "2026-10-12"), t(-1, "09:20", "2026-10-13")];
    const b = evaluateAll(ts, { ...OFF, maxTradesPerDay: 1 });
    assert.deepEqual(b.map((x) => x.date), ["2026-10-12"]);
  });
});

describe("dayStatus", () => {
  it("reports usage and states", () => {
    const s = dayStatus([t(-1000, "09:20"), t(-2400, "09:40")], { ...OFF, maxDailyLoss: 4000, maxTradesPerDay: 3, maxLossPerTrade: 2000 });
    const by = Object.fromEntries(s.map((x) => [x.rule, x]));
    assert.equal(by.DAILY_LOSS.current, 3400);
    assert.equal(by.DAILY_LOSS.state, "warning"); // 85% used
    assert.equal(by.TRADE_COUNT.state, "ok");
    assert.equal(by.PER_TRADE_LOSS.state, "breached");
  });

  it("losing-streak status keeps the day's longest streak after a later win", () => {
    const s = dayStatus([t(-100, "09:20"), t(-100, "09:40"), t(-100, "10:00"), t(500, "10:20")], { ...OFF, maxConsecutiveLosses: 2 });
    assert.equal(s[0].current, 3);
    assert.equal(s[0].state, "breached");
  });
});
