import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "../format";
import { executeQuery, type QueryTrade } from "./journal-query";

const t = (netPnl: number, o: Partial<QueryTrade> & { time?: string } = {}): QueryTrade =>
  ({
    id: Math.random().toString(36),
    entryAt: fromIST("2026-10-13", o.time ?? "10:00"),
    exitAt: fromIST("2026-10-13", o.time ?? "10:00"),
    netPnl,
    grossPnl: netPnl + 40,
    totalCharges: 40,
    rMultiple: null,
    points: null,
    underlying: "NIFTY",
    segment: "OPT",
    strategyId: null,
    emotionBefore: null,
    isExpiryDay: false,
    followedPlan: null,
    plannedSL: null,
    direction: "LONG",
    tags: [],
    ...o,
  }) as QueryTrade;

const trades = [
  t(1000, { isExpiryDay: true }),
  t(-3000, { isExpiryDay: true, time: "14:20" }),
  t(500, { underlying: "BANKNIFTY", strategyId: "s1" }),
  t(-200, { emotionBefore: "Revenge" }),
];
const ctx = { strategies: { s1: "VWAP Pullback" } };

describe("executeQuery", () => {
  it("answers 'win rate on expiry days' from code", () => {
    const r = executeQuery(trades, { expiry: "yes" }, ctx) as { stats: { trades: number; win_rate_pct: number; net_pnl_inr: number } };
    assert.equal(r.stats.trades, 2);
    assert.equal(r.stats.win_rate_pct, 50);
    assert.equal(r.stats.net_pnl_inr, -2000);
  });

  it("maps strategy names, symbols, time windows and grouping", () => {
    const byName = executeQuery(trades, { strategy: "vwap pullback" }, ctx) as { stats: { trades: number } };
    assert.equal(byName.stats.trades, 1);
    const sym = executeQuery(trades, { symbol: "banknifty" }, ctx) as { stats: { trades: number } };
    assert.equal(sym.stats.trades, 1);
    const late = executeQuery(trades, { time_from: "14:00" }, ctx) as { stats: { trades: number } };
    assert.equal(late.stats.trades, 1);
    const grouped = executeQuery(trades, { group_by: "expiry" }, ctx) as { groups: { group: string; trades: number }[] };
    assert.deepEqual(grouped.groups.map((g) => [g.group, g.trades]), [["Expiry day", 2], ["Non-expiry day", 2]]);
  });

  it("explains unknown strategies and empty results", () => {
    const r = executeQuery(trades, { strategy: "Moon shot" }, ctx) as { notes: string[] };
    assert.match(r.notes[0], /No strategy named/);
    const empty = executeQuery(trades, { emotions: ["Bored"] }, ctx) as { notes: string[] };
    assert.ok(empty.notes.includes("No trades match this filter."));
  });
});
