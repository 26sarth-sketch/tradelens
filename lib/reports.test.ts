import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareMetrics, cumulativeByTrade } from "./compare";
import { applyFilter, describeFilter, filterToParams, parseFilter } from "./filters";
import { fromIST } from "./format";
import { groupReport, reportInsights, type ReportTrade } from "./reports";

function trade(netPnl: number, opts: Partial<ReportTrade> & { day?: string; time?: string; tagNames?: string[] } = {}): ReportTrade {
  const at = fromIST(opts.day ?? "2026-10-12", opts.time ?? "10:00"); // Mon 12 Oct
  return {
    entryAt: at,
    exitAt: at,
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
    tags: (opts.tagNames ?? []).map((name) => ({ tag: { name }, accepted: true })),
    ...opts,
  } as ReportTrade & { followedPlan: boolean | null; plannedSL: number | null; direction: string };
}

const withExtras = (t: ReportTrade, extra: Record<string, unknown> = {}) =>
  ({ followedPlan: null, plannedSL: null, direction: "LONG", ...t, ...extra });

describe("groupReport", () => {
  it("day of week in calendar order", () => {
    const rows = groupReport("day", [trade(100, { day: "2026-10-13" }), trade(-50, { day: "2026-10-12" }), trade(30, { day: "2026-10-12" })]);
    assert.deepEqual(rows.map((r) => [r.label, r.stats.count, r.stats.net]), [["Mon", 2, -20], ["Tue", 1, 100]]);
  });

  it("time of day buckets from 09:15, 30 or 15 minutes", () => {
    const ts = [trade(1, { time: "09:16" }), trade(2, { time: "09:44" }), trade(3, { time: "09:45" }), trade(4, { time: "15:29" })];
    assert.deepEqual(groupReport("time", ts).map((r) => [r.label, r.stats.count]), [["09:15–09:45", 2], ["09:45–10:15", 1], ["15:15–15:30", 1]]);
    assert.deepEqual(groupReport("time", ts, { bucketMinutes: 15 }).map((r) => r.label), ["09:15–09:30", "09:30–09:45", "09:45–10:00", "15:15–15:30"]);
  });

  it("a trade with two tags counts in both; untagged gets its own row", () => {
    const rows = groupReport("tag", [trade(100, { tagNames: ["A+ setup", "News"] }), trade(-10)]);
    assert.deepEqual(rows.map((r) => r.label).sort(), ["A+ setup", "News", "Untagged"]);
  });

  it("strategy names come from the lookup", () => {
    const rows = groupReport("strategy", [trade(10, { strategyId: "s1" }), trade(5)], { strategies: { s1: "ORB" } });
    assert.deepEqual(rows.map((r) => r.label), ["ORB", "No strategy"]);
  });

  it("insights pick best and worst among groups with enough trades", () => {
    const ts = [
      ...Array.from({ length: 5 }, () => trade(100, { day: "2026-10-12" })),
      ...Array.from({ length: 5 }, () => trade(-200, { day: "2026-10-13" })),
      trade(9999, { day: "2026-10-14" }), // only 1 trade: ignored
    ];
    const ins = reportInsights(groupReport("day", ts))!;
    assert.equal(ins.best.label, "Mon");
    assert.equal(ins.worst.label, "Tue");
  });
});

describe("filters", () => {
  const ts = [
    withExtras(trade(100, { time: "10:00" }), { followedPlan: true, plannedSL: 90 }),
    withExtras(trade(-100, { time: "14:30", emotionBefore: "Revenge" }), { followedPlan: false }),
    withExtras(trade(-50, { time: "11:00", isExpiryDay: true, tagNames: ["Overtrading"] }), { followedPlan: false }),
  ];

  it("plan, time window, expiry, emotion, stop-loss, tag", () => {
    assert.equal(applyFilter(ts, { plan: "broke" }).length, 2);
    assert.equal(applyFilter(ts, { timeFrom: "14:00" }).length, 1);
    assert.equal(applyFilter(ts, { timeTo: "14:00" }).length, 2);
    assert.equal(applyFilter(ts, { expiry: "yes" }).length, 1);
    assert.equal(applyFilter(ts, { emotions: ["Revenge", "FOMO"] }).length, 1);
    assert.equal(applyFilter(ts, { stopLoss: "yes" }).length, 1);
    assert.equal(applyFilter(ts, { tag: "Overtrading" }).length, 1);
    assert.equal(applyFilter(ts, { tag: "none" }).length, 2);
  });

  it("round-trips through URL params with a prefix, ignoring junk", () => {
    const f = { plan: "followed" as const, emotions: ["Calm", "Confident"], timeFrom: "09:15" };
    const p = filterToParams(f, "a.");
    assert.equal(p.get("a.emotions"), "Calm,Confident");
    assert.deepEqual(parseFilter(Object.fromEntries(p), "a."), f);
    assert.deepEqual(parseFilter({ plan: "maybe", segment: "CRYPTO", from: "yesterday" }), {});
  });

  it("describes itself", () => {
    assert.equal(describeFilter({ plan: "broke", timeFrom: "14:00" }), "broke plan · after 14:00");
    assert.equal(describeFilter({}), "All trades");
  });
});


describe("compare", () => {
  it("marks the better side per metric", () => {
    const a = [trade(500), trade(300), trade(-100)];
    const b = [trade(-400), trade(200)];
    const { rows } = compareMetrics(a, b);
    const row = (l: string) => rows.find((r) => r.label === l)!;
    assert.equal(row("Net P&L").winner, "a");
    assert.equal(row("Average loss").winner, "a"); // 100 < 400, lower is better
    assert.equal(row("Trades").winner, null);
  });

  it("cumulative curves share a trade-number axis", () => {
    const pts = cumulativeByTrade([trade(10), trade(20)], [trade(-5)]);
    assert.deepEqual(pts, [{ n: 1, a: 10, b: -5 }, { n: 2, a: 30, b: null }]);
  });
});
