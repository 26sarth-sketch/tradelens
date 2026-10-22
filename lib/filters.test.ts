import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFilter } from "./filters";
import { isDayKey } from "./format";

describe("isDayKey", () => {
  it("accepts real calendar days only", () => {
    assert.equal(isDayKey("2026-10-22"), true);
    assert.equal(isDayKey("2028-02-29"), true);
    for (const bad of ["2026-13-45", "2026-02-30", "2026-10-2", "abc", "2026-10-22T00:00"]) assert.equal(isDayKey(bad), false, bad);
  });
});

describe("parseFilter", () => {
  it("ignores impossible dates and unknown values instead of failing", () => {
    const f = parseFilter({ from: "zzz", to: "2026-13-45", segment: "XYZ", plan: "maybe", emotions: ",," });
    assert.equal(f.from, undefined);
    assert.equal(f.to, undefined);
    assert.equal(f.segment, undefined);
    assert.equal(f.plan, undefined);
  });

  it("keeps valid values", () => {
    const f = parseFilter({ from: "2026-10-19", to: "2026-10-23", segment: "OPT", plan: "followed" });
    assert.deepEqual([f.from, f.to, f.segment, f.plan], ["2026-10-19", "2026-10-23", "OPT", "followed"]);
  });
});
