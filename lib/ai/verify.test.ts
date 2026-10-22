import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFigures, verifyNumbers } from "./verify";

describe("extractFigures", () => {
  it("reads rupees in Indian format, lakh/K units, % and R", () => {
    const f = extractFigures("You made ₹1,55,959 (₹1.56L) on 84 trades, 79.8% wins, avg +0.77R, lost −₹1,43,107 and ₹12.9K");
    assert.deepEqual(
      f.map((x) => [x.kind, x.value]),
      [["inr", 155959], ["inr", 156000], ["pct", 79.8], ["r", 0.77], ["inr", -143107], ["inr", 12900]],
    );
  });

  it("skips times, dates and small counts", () => {
    assert.equal(extractFigures("After 14:00 on 12 Oct you took 3 trades on 2026-10-12").length, 0);
  });
});

describe("verifyNumbers", () => {
  const data = {
    overall: { net_pnl_inr: 12852, win_rate_pct: 52.7, charges_pct_of_gross_profit: 66.6 },
    followed: { expectancy_per_trade_inr: 1857, net_pnl_inr: 155959 },
    broke: { expectancy_per_trade_inr: -1022, net_pnl_inr: -143107 },
  };

  it("accepts exact, rounded and compact forms", () => {
    const v = verifyNumbers({ text: "Net ₹12,852 (₹12.9K), win rate 53%, charges ate 67% of profit" }, data);
    assert.equal(v.checked, 4);
    assert.deepEqual(v.unverified, []);
  });

  it("accepts a simple difference of two data numbers", () => {
    // 1,857 − (−1,022) = 2,879
    assert.deepEqual(verifyNumbers("each trade made ₹2,879 more", data).unverified, []);
  });

  it("does not accept sums of unrelated numbers", () => {
    // 155959 − 143107 + … would be easy to hit by accident if any two numbers could combine;
    // 12852 + 1857 = 14709 mixes two different metrics, so it must be flagged.
    assert.deepEqual(verifyNumbers("₹14,709", data).unverified, ["₹14,709"]);
  });

  it("accepts how far a breach went over its own limit, but not across breaches", () => {
    const breaches = { risk_rule_breaches: [{ rule: "PER_TRADE_LOSS", value: 5545, limit: 2000 }, { rule: "DAILY_LOSS", value: 4200, limit: 4000 }] };
    assert.deepEqual(verifyNumbers("lost ₹3,545 more than the limit", breaches).unverified, []);
    assert.deepEqual(verifyNumbers("₹1,545", breaches).unverified, ["₹1,545"]); // 5545 − 4000 mixes two breaches
  });

  it("flags invented figures", () => {
    assert.deepEqual(verifyNumbers(["You could make ₹50,000 next month", "win rate 90%"], data).unverified, ["₹50,000", "90%"]);
  });
});
