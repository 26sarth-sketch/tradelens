// Hand-worked examples. Each expected figure was computed by hand from the rates in
// config/market.ts; if you change a rate, these numbers must be re-derived.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chargesPctOfGross, computeCharges, computeTradePnl } from "./charges";

describe("computeTradePnl", () => {
  it("NIFTY option long: 1 lot (65) bought 120, sold 150", () => {
    // buy 7,800 · sell 9,750 · turnover 17,550
    const r = computeTradePnl({
      exchange: "NSE", segment: "OPT", direction: "LONG", qty: 65, avgEntry: 120, avgExit: 150,
    });
    assert.equal(r.brokerage, 40); //       ₹20 × 2 orders
    assert.equal(r.stt, 14.63); //          0.15% × 9,750 = 14.625
    assert.equal(r.exchangeTxn, 6.15); //   0.03503% × 17,550 = 6.1478
    assert.equal(r.sebiFee, 0.02); //       ₹10/cr × 17,550 = 0.01755
    assert.equal(r.stampDuty, 0.23); //     0.003% × 7,800 = 0.234
    assert.equal(r.gst, 8.31); //           18% × (40 + 6.15 + 0.02) = 8.3106
    assert.equal(r.otherCharges, 0);
    assert.equal(r.totalCharges, 69.34);
    assert.equal(r.grossPnl, 1950);
    assert.equal(r.netPnl, 1880.66);
    assert.equal(r.points, 30);
  });

  it("Intraday equity short: RELIANCE 120 sold 2,900, covered 2,880", () => {
    // sell 3,48,000 · buy 3,45,600 · turnover 6,93,600
    const r = computeTradePnl({
      exchange: "NSE", segment: "EQ_INTRADAY", direction: "SHORT", qty: 120, avgEntry: 2900, avgExit: 2880,
    });
    assert.equal(r.brokerage, 40); //       min(0.03% × value, ₹20) per side → capped at 20 each
    assert.equal(r.stt, 87); //             0.025% × 3,48,000
    assert.equal(r.exchangeTxn, 20.6); //   0.00297% × 6,93,600 = 20.5999
    assert.equal(r.sebiFee, 0.69); //       0.6936
    assert.equal(r.stampDuty, 10.37); //    0.003% × 3,45,600 = 10.368
    assert.equal(r.gst, 11.03); //          18% × 61.29 = 11.0322
    assert.equal(r.totalCharges, 169.69);
    assert.equal(r.grossPnl, 2400);
    assert.equal(r.netPnl, 2230.31);
    assert.equal(r.points, 20);
  });

  it("Delivery long: INFY 40 bought 1,500, sold 1,600 (zero brokerage, DP charge)", () => {
    // buy 60,000 · sell 64,000 · turnover 1,24,000
    const r = computeTradePnl({
      exchange: "NSE", segment: "EQ_DELIVERY", direction: "LONG", qty: 40, avgEntry: 1500, avgExit: 1600,
    });
    assert.equal(r.brokerage, 0);
    assert.equal(r.stt, 124); //            0.1% on both sides
    assert.equal(r.exchangeTxn, 3.68); //   3.6828
    assert.equal(r.sebiFee, 0.12);
    assert.equal(r.stampDuty, 9); //        0.015% × 60,000
    assert.equal(r.gst, 0.68); //           18% × 3.80 = 0.684
    assert.equal(r.otherCharges, 15.34); // DP charge on the sell
    assert.equal(r.totalCharges, 152.82);
    assert.equal(r.netPnl, 3847.18);
  });

  it("NIFTY futures short: 1 lot (65) sold 24,600, covered 24,500", () => {
    // sell 15,99,000 · buy 15,92,500 · turnover 31,91,500
    const r = computeTradePnl({
      exchange: "NSE", segment: "FUT", direction: "SHORT", qty: 65, avgEntry: 24600, avgExit: 24500,
    });
    assert.equal(r.brokerage, 40);
    assert.equal(r.stt, 799.5); //          0.05% × 15,99,000
    assert.equal(r.exchangeTxn, 55.21); //  0.00173% × 31,91,500 = 55.2130
    assert.equal(r.sebiFee, 3.19);
    assert.equal(r.stampDuty, 31.85); //    0.002% × 15,92,500
    assert.equal(r.gst, 17.71); //          18% × 98.40 = 17.712
    assert.equal(r.totalCharges, 947.46);
    assert.equal(r.grossPnl, 6500);
    assert.equal(r.netPnl, 5552.54);
    assert.equal(r.points, 100);
  });

  it("losing option trade: net loss is bigger than gross loss", () => {
    const r = computeTradePnl({
      exchange: "NSE", segment: "OPT", direction: "LONG", qty: 65, avgEntry: 150, avgExit: 120,
    });
    assert.equal(r.grossPnl, -1950);
    assert.ok(r.netPnl < r.grossPnl);
    assert.equal(r.points, -30);
  });
});

describe("computeCharges", () => {
  it("percentage brokerage applies below the ₹20 cap", () => {
    // 0.03% × 5,000 = 1.50 and 0.03% × 5,200 = 1.56
    const c = computeCharges({ exchange: "NSE", segment: "EQ_INTRADAY", buyValue: 5000, sellValue: 5200 });
    assert.equal(c.brokerage, 3.06);
  });

  it("brokerage is per executed order", () => {
    const c = computeCharges({
      exchange: "NSE", segment: "OPT", buyValue: 10000, sellValue: 12000, buyOrders: 3, sellOrders: 2,
    });
    assert.equal(c.brokerage, 100);
  });

  it("FLAT20 plan charges brokerage on delivery", () => {
    const c = computeCharges({
      exchange: "NSE", segment: "EQ_DELIVERY", buyValue: 60000, sellValue: 64000, plan: "FLAT20",
    });
    assert.equal(c.brokerage, 40);
  });

  it("BSE options use BSE exchange rates", () => {
    // 0.0325% × (10,000 + 12,000) = 7.15
    const c = computeCharges({ exchange: "BSE", segment: "OPT", buyValue: 10000, sellValue: 12000 });
    assert.equal(c.exchangeTxn, 7.15);
  });
});

describe("chargesPctOfGross", () => {
  it("is charges / gross profit", () => {
    assert.equal(chargesPctOfGross(500, 2000), 25);
  });
  it("is null when there's no gross profit", () => {
    assert.equal(chargesPctOfGross(500, 0), null);
    assert.equal(chargesPctOfGross(500, -100), null);
  });
});
