import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fromIST } from "../format";
import { parseDay, parseGenericCsv, parseSpacedFno, parseTime, readCsv } from "./generic";
import { autoMap, BROKER_PRESETS, detectPreset } from "./presets";
import { groupRoundTrips, segmentOf } from "./roundtrip";

const sample = (name: string) => readFileSync(new URL(`../../public/samples/${name}`, import.meta.url), "utf8");

describe("date and time parsing", () => {
  it("reads Indian day-first formats", () => {
    assert.equal(parseDay("16-10-2026"), "2026-10-16");
    assert.equal(parseDay("16/10/26"), "2026-10-16");
    assert.equal(parseDay("2026-10-16"), "2026-10-16");
    assert.equal(parseDay("16-Oct-2026"), "2026-10-16");
    assert.equal(parseDay("16 October 2026"), "2026-10-16");
    assert.equal(parseDay("Oct 16, 2026"), "2026-10-16");
    assert.equal(parseDay("garbage"), null);
  });

  it("reads 12h and 24h times", () => {
    assert.equal(parseTime("09:31:12"), "09:31:12");
    assert.equal(parseTime("01:20 PM"), "13:20:00");
    assert.equal(parseTime("12:05 AM"), "00:05:00");
  });
});

describe("parseSpacedFno", () => {
  it("strike, type and dated expiry", () => {
    const p = parseSpacedFno("NIFTY 25300 CE 20 OCT 26")!;
    assert.equal(p.underlying, "NIFTY");
    assert.equal(p.kind, "OPT");
    assert.equal(p.strike, 25300);
    assert.equal(p.optionType, "CE");
    assert.equal(p.expiry!.toISOString(), fromIST("2026-10-20", "15:30").toISOString());
  });

  it("glued dates and CALL/PUT words", () => {
    const p = parseSpacedFno("BANKNIFTY 27OCT2026 52500 PUT")!;
    assert.equal(p.optionType, "PE");
    assert.equal(p.strike, 52500);
    assert.equal(p.expiry!.toISOString(), fromIST("2026-10-27", "15:30").toISOString());
  });

  it("monthly futures without a day use the last expiry weekday", () => {
    const p = parseSpacedFno("NIFTY OCT 2026 FUT")!;
    assert.equal(p.kind, "FUT");
    assert.equal(p.expiry!.toISOString(), fromIST("2026-10-27", "15:30").toISOString());
  });

  it("plain equities are not F&O", () => {
    assert.equal(parseSpacedFno("TATAMOTORS"), null);
    assert.equal(parseSpacedFno("RELIANCE-EQ"), null);
  });
});

describe("presets", () => {
  it("detects Upstox and maps every needed column", () => {
    const { headers } = readCsv(sample("upstox_tradebook.csv"));
    const preset = detectPreset(headers);
    assert.equal(preset.id, "upstox");
    const map = autoMap(headers, preset);
    assert.equal(map.symbol, "Scrip Name");
    assert.equal(map.time, "Trade Time");
    assert.equal(map.tradeId, "Trade Num");
  });

  it("detects Groww and prefers the ticker over the company name", () => {
    const { headers } = readCsv(sample("groww_orders.csv"));
    const preset = detectPreset(headers);
    assert.equal(preset.id, "groww");
    const map = autoMap(headers, preset);
    assert.equal(map.symbol, "Symbol");
    assert.equal(map.date, "Execution date and time");
    assert.equal(map.tradeId, undefined);
  });

  it("has presets for the four brokers plus Other", () => {
    assert.deepEqual(BROKER_PRESETS.map((p) => p.id), ["upstox", "angelone", "groww", "dhan", "other"]);
  });
});

describe("parseGenericCsv", () => {
  it("Upstox sample → 5 round trips with the right segments", () => {
    const csv = sample("upstox_tradebook.csv");
    const { headers } = readCsv(csv);
    const r = parseGenericCsv(csv, autoMap(headers, detectPreset(headers)), { broker: "Upstox" });
    assert.equal(r.issues.length, 0);
    assert.equal(r.fills.length, 10);
    assert.equal(r.fills[0].brokerTradeId, "UPSTOX:NSE:7712001");
    const { trades, open } = groupRoundTrips(r.fills);
    assert.equal(trades.length, 5);
    assert.equal(open.length, 0);
    const segs = trades.map(segmentOf).sort();
    assert.deepEqual(segs, ["EQ_INTRADAY", "EQ_INTRADAY", "OPT", "OPT", "OPT"]);
    const tata = trades.find((t) => t.instrument.underlying === "TATAMOTORS")!;
    assert.equal(tata.direction, "SHORT");
  });

  it("Groww sample: 12-hour times, content-hash ids", () => {
    const csv = sample("groww_orders.csv");
    const { headers } = readCsv(csv);
    const r = parseGenericCsv(csv, autoMap(headers, detectPreset(headers)), { broker: "Groww" });
    assert.equal(r.fills.length, 4);
    assert.equal(r.fills[1].executedAt.toISOString(), fromIST("2026-10-19", "13:20").toISOString());
    assert.match(r.fills[0].brokerTradeId!, /^GROWW:H:/);
    // Same file twice → same ids, so dedupe works without trade ids.
    const again = parseGenericCsv(csv, autoMap(headers, detectPreset(headers)), { broker: "Groww" });
    assert.deepEqual(again.fills.map((f) => f.brokerTradeId), r.fills.map((f) => f.brokerTradeId));
  });

  it("skips rejected orders and unknown sides, converts lots", () => {
    const csv = [
      "Date,Symbol,Side,Qty,Price,Status",
      "16-10-2026 09:30,NIFTY 25300 CE 20 OCT 26,B,2,88,Complete",
      "16-10-2026 09:40,NIFTY 25300 CE 20 OCT 26,X,2,90,Complete",
      "16-10-2026 09:50,NIFTY 25300 CE 20 OCT 26,S,2,95,Rejected",
    ].join("\n");
    const map = { date: "Date", symbol: "Symbol", side: "Side", qty: "Qty", price: "Price", status: "Status" };
    const r = parseGenericCsv(csv, map, { broker: "Dhan", qtyInLots: true });
    assert.equal(r.fills.length, 1);
    assert.equal(r.fills[0].qty, 130); // 2 lots × 65
    assert.equal(r.issues.length, 2);
  });

  it("requires the core columns", () => {
    assert.throws(() => parseGenericCsv("a,b\n1,2", { date: "a" }, { broker: "x" }), /Map these columns/);
  });
});
