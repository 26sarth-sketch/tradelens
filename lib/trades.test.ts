import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { buildTradeData, displaySymbol, excursions } from "./trades";

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


describe("excursions", () => {
  it("long: MFE from the high, MAE from the low, money left on table", () => {
    // entry 120, exit 150, high 170, low 110, qty 65
    const e = excursions({ direction: "LONG", qty: 65, avgEntry: 120, avgExit: 150, highPrice: 170, lowPrice: 110 })!;
    assert.equal(e.mfe, 3250); // 50 × 65
    assert.equal(e.mae, 650); // 10 × 65
    assert.equal(e.leftOnTable, 1300); // 20 × 65
    assert.equal(e.capturedPct, 60); // 30 of 50
  });

  it("short: best price is the low", () => {
    const e = excursions({ direction: "SHORT", qty: 10, avgEntry: 200, avgExit: 190, highPrice: 205, lowPrice: 180 })!;
    assert.equal(e.bestPrice, 180);
    assert.equal(e.mfe, 200);
    assert.equal(e.mae, 50);
    assert.equal(e.leftOnTable, 100);
  });

  it("null without high/low", () => {
    assert.equal(excursions({ direction: "LONG", qty: 1, avgEntry: 1, avgExit: 2, highPrice: null, lowPrice: 1 }), null);
  });
});
