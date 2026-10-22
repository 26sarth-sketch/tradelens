import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { computeStats, dailyStats, equityCurve, maxDrawdown, type StatTrade } from "./stats";

let minute = 0;
function t(netPnl: number, opts: Partial<StatTrade> & { day?: string } = {}): StatTrade {
  minute += 5;
  const at = fromIST(opts.day ?? "2026-10-12", `10:${String(minute % 60).padStart(2, "0")}`);
  return {
    entryAt: at,
    exitAt: at,
    netPnl,
    grossPnl: netPnl + 50,
    totalCharges: 50,
    rMultiple: null,
    points: null,
    underlying: "NIFTY",
    ...opts,
  };
}

// Hand-worked set: +1000, -500, +2000, -1500, +500
//   wins 3 (3500), losses 2 (2000) → win rate 60%, PF 1.75
//   avg win 1166.67, avg loss 1000 → ratio 1.1667
//   net 1500 → expectancy 300
//   running: 1000, 500, 2500, 1000, 1500 → max drawdown 1500 (from 2500 to 1000)
const SET = [t(1000), t(-500), t(2000), t(-1500), t(500)];

describe("computeStats (₹)", () => {
  const s = computeStats(SET);
  it("win rate, profit factor, averages", () => {
    assert.equal(s.count, 5);
    assert.equal(s.wins, 3);
    assert.equal(s.winRate, 60);
    assert.equal(s.profitFactor, 1.75);
    assert.equal(Math.round(s.avgWin * 100) / 100, 1166.67);
    assert.equal(s.avgLoss, 1000);
    assert.equal(Math.round(s.winLossRatio! * 10000) / 10000, 1.1667);
  });
  it("expectancy and drawdown", () => {
    assert.equal(s.net, 1500);
    assert.equal(s.expectancy, 300);
    assert.equal(s.maxDrawdown, 1500);
  });
  it("charges as % of gross", () => {
    // gross = 1500 + 5×50 = 1750; charges 250 → 14.29%
    assert.equal(s.totalCharges, 250);
    assert.equal(Math.round(s.chargesPctOfGross! * 100) / 100, 14.29);
  });
  it("drawdown % is of the account peak when capital is given", () => {
    const c = computeStats(SET, { capital: 100000 });
    assert.equal(c.maxDrawdown, 1500);
    assert.equal(Math.round(c.maxDrawdownPct! * 1000) / 1000, Math.round((1500 / 102500) * 100 * 1000) / 1000);
  });
});

describe("views", () => {
  it("% of capital", () => {
    const s = computeStats(SET, { view: "pct", capital: 100000 });
    assert.equal(s.net, 1.5);
    assert.equal(s.expectancy, 0.3);
  });
  it("R only counts trades with a stop-loss", () => {
    const s = computeStats([t(1000, { rMultiple: 2 }), t(-500, { rMultiple: -1 }), t(300)], { view: "r" });
    assert.equal(s.count, 2);
    assert.equal(s.totalTrades, 3);
    assert.equal(s.net, 1);
    assert.equal(s.profitFactor, 2);
  });
  it("points only count index underlyings", () => {
    const s = computeStats([t(100, { points: 30 }), t(100, { points: 5, underlying: "RELIANCE" })], { view: "points" });
    assert.equal(s.count, 1);
    assert.equal(s.net, 30);
  });
  it("no losses → profit factor and ratio are null", () => {
    const s = computeStats([t(100), t(200)]);
    assert.equal(s.profitFactor, null);
    assert.equal(s.winLossRatio, null);
  });
});

describe("maxDrawdown", () => {
  it("handles an immediate loss from the start", () => {
    assert.equal(maxDrawdown([-300, 100, -200]).amount, 400);
  });
});

describe("daily series", () => {
  it("groups by IST day and accumulates", () => {
    const days = dailyStats([t(100, { day: "2026-10-12" }), t(-50, { day: "2026-10-12" }), t(-200, { day: "2026-10-13" })]);
    assert.deepEqual(days.map((d) => [d.date, d.value, d.trades]), [["2026-10-12", 50, 2], ["2026-10-13", -200, 1]]);
    const curve = equityCurve(days);
    assert.deepEqual(curve.map((p) => [p.cumulative, p.drawdown]), [[50, 0], [-150, -200]]);
  });
});
