import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { disciplineByDay, mondayOf, type ProgressTrade, streaks } from "./progress";

const t = (day: string, netPnl: number, followedPlan: boolean | null = true): ProgressTrade => ({
  entryAt: fromIST(day, "10:00"),
  exitAt: fromIST(day, "10:30"),
  netPnl,
  grossPnl: netPnl,
  totalCharges: 0,
  rMultiple: null,
  points: null,
  underlying: "NIFTY",
  followedPlan,
});

describe("discipline and streaks", () => {
  // Mon–Fri: clean, breach, clean, clean, broke plan; then Mon clean, Tue clean
  const trades = [
    t("2026-10-12", 100), t("2026-10-13", -50), t("2026-10-14", 80), t("2026-10-15", 20),
    t("2026-10-16", -10, false), t("2026-10-19", 50), t("2026-10-20", 60),
  ];
  const breaches = new Map([["2026-10-13", 2]]);
  const days = disciplineByDay(trades, breaches);

  it("a day is disciplined with no breaches and no broken-plan trades", () => {
    assert.deepEqual(days.map((d) => d.disciplined), [true, false, true, true, false, true, true]);
  });

  it("current and best streaks", () => {
    assert.deepEqual(streaks(days), { current: 2, best: 2 });
    assert.deepEqual(streaks(days.slice(0, 4)), { current: 2, best: 2 });
    assert.deepEqual(streaks([]), { current: 0, best: 0 });
  });
});

describe("mondayOf", () => {
  it("finds the IST week's Monday", () => {
    assert.equal(mondayOf("2026-10-22"), "2026-10-19");
    assert.equal(mondayOf("2026-10-19"), "2026-10-19");
    assert.equal(mondayOf("2026-10-25"), "2026-10-19"); // Sunday
  });
});
