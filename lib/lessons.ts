// Learn section: short lessons in simple English. Text uses the coach's light
// formatting (**bold**, "- " bullets, blank line = new paragraph). The charges
// lesson's example is computed live by the charges engine, so it always matches
// config/market.ts.

import { SCORE_NAME } from "@/config/brand";
import { computeTradePnl } from "./charges";
import { formatINR } from "./format";

export type Lesson = {
  slug: string;
  title: string;
  minutes: number;
  summary: string;
  body: string;
  tryIt?: { href: string; label: string };
};

function chargesExample() {
  // One NIFTY option round trip: 1 lot of 65, bought at 120, sold at 123 (a typical quick scalp).
  const t = computeTradePnl({ exchange: "NSE", segment: "OPT", direction: "LONG", qty: 65, avgEntry: 120, avgExit: 123 });
  const perDay = 5;
  return {
    gross: formatINR(t.grossPnl),
    charges: formatINR(t.totalCharges, { decimals: true }),
    net: formatINR(t.netPnl),
    pct: Math.round((t.totalCharges / t.grossPnl) * 100),
    monthCharges: formatINR(t.totalCharges * perDay * 21),
    perDay,
  };
}

export function getLessons(): Lesson[] {
  const c = chargesExample();
  return [
    {
      slug: "how-to-use-tradelens",
      title: "How to use this journal",
      minutes: 2,
      summary: "A 10-minute daily routine that turns your trades into lessons.",
      body: `A journal only helps if you use it every day. Here is a simple routine.

**Before the market opens (2 minutes)**
- Open the **Notebook** and write your plan: maximum trades, maximum loss, which strategies you will trade, and how you feel.

**After the market closes (5 minutes)**
- Import your broker tradebook (or add trades by hand).
- Open each trade and answer one question honestly: **did I follow my plan?** Add an emotion and a tag if something went wrong.
- Write two lines in the end-of-day reflection: what went well, and one thing to do differently tomorrow.

**Once a week (5 minutes)**
- Look at the **Reports** for your worst time of day, worst symbol and worst emotion.
- Use **Compare** to see "followed plan" against "broke plan". The gap is what discipline is worth to you.
- Pick **one** rule to work on next week. One rule, not five.`,
      tryIt: { href: "/notebook", label: "Write today's plan" },
    },
    {
      slug: "r-multiple",
      title: "What is an R-multiple?",
      minutes: 3,
      summary: "Measure every trade against the risk you took, not in rupees.",
      body: `**R** is the amount you planned to risk on a trade: the distance from your entry to your stop-loss, times your quantity.

If you buy 1 lot of 65 NIFTY options at ₹100 with a stop-loss at ₹80, your risk is ₹20 × 65 = **₹1,300. That is 1R.**

- Exit at ₹140 and you made ₹2,600, which is **+2R**.
- Get stopped out and you lost ₹1,300, which is **−1R**.
- Hold a loser down to ₹60 and you lost **−2R**: twice what you planned.

**Why it matters:** rupees hide the real story. A ₹5,000 win on a trade where you risked ₹10,000 (+0.5R) is worse than a ₹2,000 win where you risked ₹1,000 (+2R).

**Expectancy** is your average R per trade. If it's positive, your process makes money over many trades, even with plenty of losers. In TradeLens, add a stop-loss to each trade and switch the dashboard to **R-multiple**.`,
      tryIt: { href: "/dashboard?view=r", label: "See your dashboard in R" },
    },
    {
      slug: "profit-factor",
      title: "Profit factor and the win-rate trap",
      minutes: 3,
      summary: "Why a 70% win rate can still lose money.",
      body: `**Win rate** is the share of your trades that made money. It feels important, but on its own it means little.

**Profit factor** = total of all your winning trades ÷ total of all your losing trades.
- Above **1.0**: you're making money overall.
- Around **1.5–2.0**: a healthy, sustainable edge.
- Below **1.0**: you're losing money, whatever your win rate.

**The trap:** many beginners book small profits quickly and hold losers hoping they come back. That gives a high win rate and a profit factor below 1. Ten wins of ₹500 and three losses of ₹2,500 is a 77% win rate and a **loss** of ₹2,500.

Look at **average win vs average loss** on your dashboard. If your average loss is bigger than your average win, fix that first: honour your stop-loss and let winners reach your target.`,
      tryIt: { href: "/dashboard", label: "Check your profit factor" },
    },
    {
      slug: "why-charges-matter",
      title: "Why charges matter so much in F&O",
      minutes: 3,
      summary: "Brokerage is the small part. STT, exchange fees and GST add up fast.",
      body: `Every time you trade, you pay more than brokerage. On each option round trip you also pay **STT** on the sell side, **exchange transaction charges**, a **SEBI fee**, **stamp duty** on the buy side and **18% GST** on brokerage and exchange charges.

**A real example** (calculated with today's rates in TradeLens): buy 1 lot of NIFTY options at ₹120 and sell at ₹123, a quick 3-point scalp.
- Gross profit: **${c.gross}**
- Charges: **${c.charges}**
- What you keep: **${c.net}**. Charges took **${c.pct}%** of the profit.

Do ${c.perDay} trades like that every day and you pay about **${c.monthCharges} a month** in charges, win or lose.

**What to do about it**
- Fewer, better trades. Overtrading is the most expensive habit in F&O.
- Aim for moves that are large compared with your costs.
- Watch **charges as % of gross profit** on your dashboard. If it's above 30–40%, your costs are eating your edge.`,
      tryIt: { href: "/dashboard", label: "See what charges cost you" },
    },
    {
      slug: "position-sizing",
      title: "Position sizing: how many lots?",
      minutes: 3,
      summary: "Risk a fixed small share of your capital on every trade.",
      body: `Position sizing decides how much you can lose on one trade. Get it wrong and one bad day can undo a month.

**The 1% rule:** risk at most 1% of your trading capital on any single trade. With ₹3,00,000 of capital, that's ₹3,000 per trade.

**From risk to lots:** lots = risk per trade ÷ (stop-loss distance × lot size).
- Capital ₹3,00,000 → risk ₹3,000.
- NIFTY option at ₹100, stop-loss at ₹80 → ₹20 per unit.
- 1 lot = 65 units → ₹1,300 risk per lot.
- ₹3,000 ÷ ₹1,300 = **2 lots** (round down).

**Rules that protect you**
- Never add lots to a losing trade.
- Don't size up after a loss to "win it back".
- Set a **max loss per trade** and **max daily loss** in Settings; TradeLens flags you when you break them.

Big **drawdowns** (falls from your peak) usually come from oversized trades, not from many small losses.`,
      tryIt: { href: "/settings#risk", label: "Set your risk limits" },
    },
    {
      slug: "revenge-trading",
      title: "Revenge trading: the most expensive emotion",
      minutes: 2,
      summary: "Why the trade right after a loss is usually your worst.",
      body: `A **revenge trade** is one you take to win back a loss, usually within minutes, often bigger than usual and without a real setup.

**How to spot it in your journal**
- Entered within about 10 minutes of a losing exit.
- Bigger size than your normal trades.
- No strategy, and the emotion was "Revenge" or "FOMO".

TradeLens's **auto-tagger** finds these for you, and the **Emotion** report shows what they cost.

**How to stop**
- Rule: **after 2 losses in a row, stop for the day.** Set it in Settings, so you're flagged when you break it.
- After any loss, step away for 15 minutes before the next trade.
- Write the loss in your journal first. Naming the feeling takes away some of its pull.`,
      tryIt: { href: "/reports?tab=emotion", label: "See your emotion report" },
    },
    {
      slug: "expiry-day-risk",
      title: "Expiry day: fast premiums, fast losses",
      minutes: 2,
      summary: "Why weekly expiry days need their own, stricter rules.",
      body: `On the day an option contract expires, its premium can move very quickly: time value disappears through the day, and small moves in the index make big percentage moves in the option.

That's why many traders find **expiry days are their worst days**: cheap premiums tempt bigger size and more trades, and losses come faster than on normal days.

**Check your own numbers:** Reports → **Expiry day** shows expiry vs normal days side by side.

**If expiry days hurt you**
- Trade smaller (1 lot) or not at all on expiry.
- Cap trades, e.g. a maximum of 2 on expiry days.
- Avoid entries in the last 90 minutes when premiums decay fastest.`,
      tryIt: { href: "/reports?tab=expiry", label: "Compare your expiry days" },
    },
    {
      slug: "lens-score",
      title: `How the ${SCORE_NAME} works`,
      minutes: 2,
      summary: "One number for the health of your trading process.",
      body: `The **${SCORE_NAME}** (0–100) combines six parts of your trading, each scored 0–100:

- **Win rate** (15%): 30% scores 0, 70% scores 100.
- **Profit factor** (20%): 0.5 scores 0, 2.5 scores 100.
- **Average win vs average loss** (15%): 0.5 scores 0, 2.0 scores 100.
- **Drawdown control** (15%): a 20% fall from your peak scores 0, no drawdown scores 100.
- **Consistency** (15%): share of green days; 30% scores 0, 70% scores 100.
- **Plan adherence** (20%): the average of the share of trades where you followed your plan and the share of days with no risk-rule breach.

Half the weight is on **process** (drawdown, consistency, plan adherence), not just results. You can raise your score by trading more carefully even before your P&L improves.

**Grades:** 80+ Excellent · 65+ Good · 50+ Developing · 35+ Needs work · below 35 At risk. It needs at least 10 trades. Watch it on the **Progress** page.`,
      tryIt: { href: "/progress", label: "See your progress" },
    },
  ];
}

export function getLesson(slug: string) {
  return getLessons().find((l) => l.slug === slug) ?? null;
}
