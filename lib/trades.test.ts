import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { buildTradeData, displaySymbol } from "./trades";

const base = {
  exchange: "NSE" as const,
  segment: "OPT" as const,
  underlying: "nifty",
  optionType: "CE" as const,
  strike: 24500,
  expiry: fromIST("2026-10-27", "15:30"),
  lotSize: 65,
  direction: "LONG" as const,
  qty: 65,
  avgEntry: 120,
  avgExit: 150,
  entryAt: fromIST("2026-10-27", "09:30"),
  exitAt: fromIST("2026-10-27", "10:00"),
};

describe("buildTradeData", () => {
  it("fills symbol, lots, expiry flag and net P&L", () => {
    const t = buildTradeData(base);
    assert.equal(t.symbol, "NIFTY 24500 CE 27 Oct");
    assert.equal(t.underlying, "NIFTY");
    assert.equal(t.lots, 1);
    assert.equal(t.isExpiryDay, true); // Tue 27 Oct 2026
    assert.equal(t.netPnl, 1880.66);
  });

  it("computes planned R:R and R-multiple from the stop-loss", () => {
    // risk 20/unit × 65 = ₹1,300; target 160 → reward 40 → 1:2
    const t = buildTradeData({ ...base, plannedSL: 100, plannedTarget: 160 });
    assert.equal(t.plannedR, 2);
    assert.equal(t.rMultiple, 1.45); // 1,880.66 / 1,300
  });

  it("leaves R empty without a stop-loss", () => {
    const t = buildTradeData(base);
    assert.equal(t.plannedR, null);
    assert.equal(t.rMultiple, null);
  });

  it("drops F&O-only fields for equity", () => {
    const t = buildTradeData({ ...base, segment: "EQ_INTRADAY", underlying: "RELIANCE", avgEntry: 2900, avgExit: 2910 });
    assert.equal(t.symbol, "RELIANCE");
    assert.equal(t.strike, null);
    assert.equal(t.lots, null);
    assert.equal(t.isExpiryDay, false);
  });
});

describe("displaySymbol", () => {
  it("formats futures", () => {
    assert.equal(displaySymbol({ ...base, segment: "FUT", underlying: "BANKNIFTY" }), "BANKNIFTY FUT 27 Oct");
  });
});
