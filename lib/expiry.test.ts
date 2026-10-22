import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromIST } from "./format";
import { isExpiryDay, lotSizeFor, nextExpiry } from "./expiry";

// Oct 2026: Tue 20, Thu 22, Tue 27 (last Tuesday), Thu 29 (last Thursday).
describe("isExpiryDay", () => {
  it("NIFTY expires every Tuesday", () => {
    assert.equal(isExpiryDay("NIFTY", "2026-10-20"), true);
    assert.equal(isExpiryDay("NIFTY", "2026-10-27"), true);
    assert.equal(isExpiryDay("NIFTY", "2026-10-22"), false);
  });

  it("BANKNIFTY expires only on the last Tuesday of the month", () => {
    assert.equal(isExpiryDay("BANKNIFTY", "2026-10-20"), false);
    assert.equal(isExpiryDay("BANKNIFTY", "2026-10-27"), true);
  });

  it("SENSEX expires every Thursday", () => {
    assert.equal(isExpiryDay("SENSEX", "2026-10-22"), true);
    assert.equal(isExpiryDay("SENSEX", "2026-10-20"), false);
  });

  it("stock F&O uses the last Tuesday", () => {
    assert.equal(isExpiryDay("RELIANCE", "2026-10-27"), true);
    assert.equal(isExpiryDay("RELIANCE", "2026-10-20"), false);
  });

  it("uses the IST day, not UTC", () => {
    // 00:30 IST on Tue 20 Oct is still Mon 19 Oct in UTC.
    assert.equal(isExpiryDay("NIFTY", fromIST("2026-10-20", "00:30")), true);
  });
});

describe("nextExpiry", () => {
  it("finds the next NIFTY Tuesday", () => {
    const e = nextExpiry("NIFTY", fromIST("2026-10-22", "10:00"));
    assert.equal(e.toISOString(), fromIST("2026-10-27", "15:30").toISOString());
  });
});

describe("lotSizeFor", () => {
  it("knows indices and common stocks, case-insensitive", () => {
    assert.equal(lotSizeFor("nifty"), 65);
    assert.equal(lotSizeFor("RELIANCE"), 500);
    assert.equal(lotSizeFor("UNKNOWNCO"), undefined);
  });
});
