import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTO_TAGS, suggestTags, type TagTrade } from "./autotag";
import { fromIST } from "./format";

let n = 0;
const t = (entry: string, exit: string, netPnl: number, o: Partial<TagTrade> & { day?: string } = {}): TagTrade => ({
  id: `t${++n}`,
  symbol: "NIFTY 25000 CE",
  entryAt: fromIST(o.day ?? "2026-10-13", entry),
  exitAt: fromIST(o.day ?? "2026-10-13", exit),
  netPnl,
  direction: "LONG",
  qty: 65,
  avgEntry: 100,
  avgExit: 100 + netPnl / 65,
  plannedSL: null,
  ...o,
});

const OFF = { maxTradesPerDay: null, noTradeAfter: null };

describe("suggestTags", () => {
  it("revenge: entered within 10 minutes of a losing exit", () => {
    const a = t("09:20", "09:40", -2100);
    const b = t("09:45", "10:00", -500); // 5 min later → revenge
    const c = t("10:30", "10:40", 300); // 30 min after b → not
    const s = suggestTags([a, b, c], OFF);
    assert.deepEqual(s.map((x) => [x.tradeId, x.tag]), [[b.id, AUTO_TAGS.REVENGE]]);
    assert.match(s[0].reason, /Entered 5 min after a -₹2,100 loss/);
  });

  it("overtrading uses the day's plan before the standing limit", () => {
    const ts = [t("09:20", "09:30", 10), t("09:40", "09:50", 10), t("10:00", "10:10", 10)];
    assert.equal(suggestTags(ts, { ...OFF, maxTradesPerDay: 2 }).length, 1);
    assert.equal(suggestTags(ts, { ...OFF, maxTradesPerDay: 2, planMaxTrades: { "2026-10-13": 3 } }).length, 0);
  });

  it("after cut-off", () => {
    const s = suggestTags([t("14:05", "14:20", 10)], { ...OFF, noTradeAfter: "14:00" });
    assert.equal(s[0].tag, AUTO_TAGS.AFTER_CUTOFF);
    assert.match(s[0].reason, /14:05/);
  });

  it("held loser: 25%+ past the stop-loss", () => {
    // risk 20/unit (SL 80); exit at 70 → 30/unit loss → 50% past SL
    const s = suggestTags([t("10:00", "10:30", -1950, { plannedSL: 80, avgExit: 70 })], OFF);
    assert.equal(s[0].tag, AUTO_TAGS.HELD_LOSER);
    assert.match(s[0].reason, /50% beyond your stop-loss/);
    // within the stop → nothing
    assert.equal(suggestTags([t("10:00", "10:30", -1300, { plannedSL: 80, avgExit: 80 })], OFF).length, 0);
  });

  it("held loser without stop-loss: much longer than typical winners and bigger than average loss", () => {
    // Five winners held 10 minutes each → typical winner hold = 10 min.
    const winners = ["09:20", "10:00", "11:00", "12:00", "13:00"].map((h) => {
      const [hh, mm] = h.split(":").map(Number);
      return t(h, `${String(hh).padStart(2, "0")}:${String(mm + 10).padStart(2, "0")}`, 500, { day: "2026-10-12" });
    });
    const smallLoss = t("09:20", "09:30", -200, { day: "2026-10-14" });
    const bigLongLoss = t("10:00", "11:30", -3000, { day: "2026-10-15" });
    const s = suggestTags([...winners, smallLoss, bigLongLoss], OFF);
    assert.deepEqual(s.map((x) => x.tradeId), [bigLongLoss.id]);
  });
});
