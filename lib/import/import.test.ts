import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fromIST } from "../format";
import { groupRoundTrips, segmentOf } from "./roundtrip";
import { parseFnoSymbol } from "./symbols";
import type { Fill } from "./types";
import { NotZerodhaError, parseZerodhaTradebook } from "./zerodha";

describe("parseFnoSymbol", () => {
  it("weekly option with letter month code", () => {
    const p = parseFnoSymbol("NIFTY26O1325200CE")!;
    assert.equal(p.underlying, "NIFTY");
    assert.equal(p.kind, "OPT");
    assert.equal(p.strike, 25200);
    assert.equal(p.optionType, "CE");
    assert.equal(p.expiry.toISOString(), fromIST("2026-10-13", "15:30").toISOString());
  });

  it("weekly option with numeric month", () => {
    const p = parseFnoSymbol("NIFTY2630324000PE")!;
    assert.equal(p.expiry.toISOString(), fromIST("2026-03-03", "15:30").toISOString());
    assert.equal(p.strike, 24000);
  });

  it("monthly option expires on the last Tuesday", () => {
    const p = parseFnoSymbol("BANKNIFTY26OCT52000PE")!;
    assert.equal(p.underlying, "BANKNIFTY");
    assert.equal(p.strike, 52000);
    assert.equal(p.expiry.toISOString(), fromIST("2026-10-27", "15:30").toISOString());
  });

  it("monthly futures and stock options", () => {
    assert.equal(parseFnoSymbol("NIFTY26OCTFUT")!.kind, "FUT");
    const s = parseFnoSymbol("RELIANCE26NOV1400CE")!;
    assert.equal(s.underlying, "RELIANCE");
    assert.equal(s.strike, 1400);
  });

  it("SENSEX monthly expires on the last Thursday", () => {
    const p = parseFnoSymbol("SENSEX26OCT84000CE")!;
    assert.equal(p.expiry.toISOString(), fromIST("2026-10-29", "15:30").toISOString());
  });

  it("returns null for equity symbols", () => {
    assert.equal(parseFnoSymbol("RELIANCE"), null);
  });
});

let row = 1;
function fill(side: "BUY" | "SELL", qty: number, price: number, time: string, day = "2026-10-12", key = "NSE:X"): Fill {
  return {
    instrument: { key, kind: key.includes("CE") ? "OPT" : "EQ", underlying: "X" },
    rawSymbol: key,
    exchange: "NSE",
    side,
    qty,
    price,
    executedAt: fromIST(day, time),
    orderId: `o${row}`,
    brokerTradeId: `t${row}`,
    row: row++,
  };
}

describe("groupRoundTrips", () => {
  it("scale-out stays one trade with weighted exit", () => {
    const { trades, open } = groupRoundTrips([
      fill("BUY", 130, 100, "09:20"),
      fill("SELL", 65, 110, "09:30"),
      fill("SELL", 65, 120, "09:40"),
    ]);
    assert.equal(trades.length, 1);
    assert.equal(open.length, 0);
    assert.equal(trades[0].qty, 130);
    assert.equal(trades[0].avgExit, 115);
    assert.equal(trades[0].buyOrders, 1);
    assert.equal(trades[0].sellOrders, 2);
  });

  it("short trade (sell first)", () => {
    const { trades } = groupRoundTrips([fill("SELL", 10, 200, "10:00"), fill("BUY", 10, 190, "10:30")]);
    assert.equal(trades[0].direction, "SHORT");
    assert.equal(trades[0].avgEntry, 200);
    assert.equal(trades[0].avgExit, 190);
  });

  it("a flipping fill is split into close + new open", () => {
    const { trades, open } = groupRoundTrips([
      fill("BUY", 50, 100, "09:20"),
      fill("SELL", 80, 105, "09:30"), // closes 50, opens short 30
      fill("BUY", 30, 101, "09:45"),
    ]);
    assert.equal(trades.length, 2);
    assert.equal(open.length, 0);
    assert.equal(trades[0].direction, "LONG");
    assert.equal(trades[0].qty, 50);
    assert.equal(trades[1].direction, "SHORT");
    assert.equal(trades[1].qty, 30);
    // The split fill keeps unique ids per part.
    const ids = [...trades[0].parts, ...trades[1].parts].map((p) => p.partId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("reports open positions instead of importing them", () => {
    const { trades, open } = groupRoundTrips([fill("BUY", 65, 90, "15:10")]);
    assert.equal(trades.length, 0);
    assert.equal(open.length, 1);
    assert.equal(open[0].netQty, 65);
  });

  it("equity held overnight is delivery, same-day is intraday", () => {
    const { trades } = groupRoundTrips([
      fill("BUY", 10, 100, "10:00", "2026-10-14", "NSE:A"),
      fill("SELL", 10, 104, "11:00", "2026-10-16", "NSE:A"),
      fill("BUY", 10, 100, "10:00", "2026-10-14", "NSE:B"),
      fill("SELL", 10, 101, "14:00", "2026-10-14", "NSE:B"),
    ]);
    const bySym = Object.fromEntries(trades.map((t) => [t.instrument.key, segmentOf(t)]));
    assert.equal(bySym["NSE:A"], "EQ_DELIVERY");
    assert.equal(bySym["NSE:B"], "EQ_INTRADAY");
  });
});

describe("parseZerodhaTradebook (public/samples/zerodha_tradebook.csv)", () => {
  const csv = readFileSync(new URL("../../public/samples/zerodha_tradebook.csv", import.meta.url), "utf8");
  const result = parseZerodhaTradebook(csv);
  const { trades, open } = groupRoundTrips(result.fills);

  it("parses every row except the MCX one", () => {
    assert.equal(result.rowCount, 22);
    assert.equal(result.fills.length, 21);
    assert.equal(result.issues.length, 1);
    assert.match(result.issues[0].message, /commodity/);
  });

  it("builds 9 round trips and 1 open position", () => {
    assert.equal(trades.length, 9);
    assert.equal(open.length, 1);
    assert.equal(open[0].rawSymbol, "NIFTY26O2025300CE");
  });

  it("maps NFO/BFO to NSE/BSE and reads IST execution times", () => {
    const sensex = trades.find((t) => t.instrument.underlying === "SENSEX")!;
    assert.equal(sensex.exchange, "BSE");
    assert.equal(sensex.entryAt.toISOString(), fromIST("2026-10-15", "09:33:18").toISOString());
    const nifty = trades[0];
    assert.equal(nifty.qty, 130);
    assert.equal(nifty.avgExit, 134.63); // (131.05 + 138.20) / 2 = 134.625
  });

  it("dedupe ids are namespaced by broker and exchange", () => {
    assert.equal(result.fills[0].brokerTradeId, "ZERODHA:NFO:40518231");
  });

  it("rejects files that aren't Zerodha tradebooks", () => {
    assert.throws(() => parseZerodhaTradebook("date,symbol,qty\n2026-10-12,X,1"), NotZerodhaError);
  });
});
