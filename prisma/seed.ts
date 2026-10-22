// Demo seed: wipes the demo user's data and recreates ~60 trading days of trades.
// Run with `npm run db:seed`. Also runs automatically on `npm run dev` if the DB is empty.

import { PrismaClient } from "@prisma/client";
import { fromIST } from "@/lib/format";
import { buildTradeData } from "@/lib/trades";
import { demoStory, generateDemo, isGoodStory, type StrategyKey, type TagKey } from "./demo-data";

const db = new PrismaClient();

const STRATEGIES: Record<StrategyKey, { name: string; description: string; color: string; entry: string[]; exit: string[]; risk: string[] }> = {
  ORB: {
    name: "15-min Opening Range Breakout",
    description: "Trade the break of the first 15-minute range on NIFTY/BANKNIFTY with volume.",
    color: "#6d5efc",
    entry: ["Mark high/low of 9:15–9:30 candle", "Enter on 5-min close outside the range", "Volume above 20-period average"],
    exit: ["Target 2R or previous day high/low", "Exit if price closes back inside the range"],
    risk: ["Stop-loss at the other side of the range or 20% of premium", "Max 2 lots", "No entry after 10:30"],
  },
  VWAP: {
    name: "VWAP Pullback",
    description: "In a trending day, buy the first clean pullback to VWAP in the trend's direction.",
    color: "#22c55e",
    entry: ["Trend established (higher highs above VWAP)", "Pullback touches VWAP", "Bullish/bearish rejection candle"],
    exit: ["Target 2R", "Trail stop below last swing"],
    risk: ["Stop-loss below the rejection candle", "Max 2 lots", "No new trades after 2 PM"],
  },
  EXPIRY: {
    name: "Expiry-day Momentum Scalp",
    description: "Small-size momentum scalps on NIFTY weekly expiry, only before 1 PM.",
    color: "#f5a524",
    entry: ["Clear momentum candle with range expansion", "Premium between ₹20 and ₹80"],
    exit: ["Book at 30–50% gain", "Exit within 15 minutes if it doesn't move"],
    risk: ["1 lot only", "Max 3 trades", "Stop trading after 2 losses"],
  },
};

const TAGS: Record<TagKey, { name: string; color: string }> = {
  REVENGE: { name: "Revenge trade", color: "#f05252" },
  OVERTRADING: { name: "Overtrading", color: "#f97316" },
  HELD_LOSER: { name: "Held loser too long", color: "#e11d48" },
  CHASED: { name: "Chased entry", color: "#eab308" },
  MOVED_SL: { name: "Moved stop-loss", color: "#a855f7" },
  A_PLUS: { name: "A+ setup", color: "#22c55e" },
};

async function main() {
  const now = new Date();
  // Find the first generator seed whose data tells the demo story (usually < 50 tries).
  let demo = generateDemo(now, 1);
  let closed = demo.trades;
  let story = demoStory(closed, closed.map((t) => buildTradeData(t)));
  for (let seed = 1; seed <= 500; seed++) {
    demo = generateDemo(now, seed);
    // Today's trades only count if they've already closed (the demo may run mid-session).
    closed = demo.trades.filter((t) => t.exitAt <= now);
    story = demoStory(closed, closed.map((t) => buildTradeData(t)));
    if (isGoodStory(story)) {
      console.log(`[seed] using generator seed ${seed}`);
      break;
    }
  }
  if (!isGoodStory(story)) console.warn("[seed] no seed matched every story criterion; using the last one");
  const { journal, missed } = demo;

  // Fresh start: one demo user.
  await db.user.deleteMany();
  const user = await db.user.create({
    data: {
      name: "Aarav",
      profile: {
        create: {
          level: "BEGINNER",
          capital: 3_00_000,
          language: "EN",
          broker: "Zerodha",
          brokeragePlan: "DISCOUNT",
          onboarded: true,
          maxDailyLoss: 4000,
          maxTradesPerDay: 3,
          maxLossPerTrade: 2000,
          maxConsecutiveLosses: 2,
          noTradeAfter: "14:00",
        },
      },
    },
  });

  const strategyIds = {} as Record<StrategyKey, string>;
  for (const [key, s] of Object.entries(STRATEGIES) as [StrategyKey, (typeof STRATEGIES)[StrategyKey]][]) {
    const withIds = (prefix: string, rules: string[]) => JSON.stringify(rules.map((text, i) => ({ id: `${prefix}${i + 1}`, text })));
    const created = await db.strategy.create({
      data: {
        userId: user.id,
        name: s.name,
        description: s.description,
        color: s.color,
        entryRules: withIds("e", s.entry),
        exitRules: withIds("x", s.exit),
        riskRules: withIds("r", s.risk),
      },
    });
    strategyIds[key] = created.id;
  }
  await db.traderProfile.update({
    where: { userId: user.id },
    data: { preferredStrategyIds: JSON.stringify([strategyIds.ORB, strategyIds.VWAP]) },
  });

  const tagIds = {} as Record<TagKey, string>;
  for (const [key, t] of Object.entries(TAGS) as [TagKey, (typeof TAGS)[TagKey]][]) {
    tagIds[key] = (await db.tag.create({ data: { userId: user.id, ...t } })).id;
  }

  // Trades
  for (const t of closed) {
    const data = buildTradeData(t);
    const strategyId = t.strategy ? strategyIds[t.strategy] : null;
    await db.trade.create({
      data: {
        ...data,
        userId: user.id,
        source: "SEED",
        strategyId,
        emotionBefore: t.emotionBefore,
        emotionAfter: t.emotionAfter,
        followedPlan: t.followedPlan,
        notes: t.notes ?? "",
        highPrice: t.highPrice,
        lowPrice: t.lowPrice,
        tags: { create: t.tags.map((k) => ({ tagId: tagIds[k] })) },
        ruleChecks: strategyId && t.followedPlan
          ? { create: { strategyId, checkedRules: JSON.stringify(["e1", "e2", "x1", "r1"]) } }
          : undefined,
      },
    });
  }

  // Daily journals
  for (const d of journal) {
    if (!d.plan && !d.notes && !d.reflection) continue;
    await db.dailyJournal.create({
      data: {
        userId: user.id,
        date: d.dayKey,
        notes: d.notes ?? "",
        planMaxTrades: d.plan?.maxTrades,
        planMaxLoss: d.plan?.maxLoss,
        planStrategyIds: JSON.stringify(d.plan?.strategies.map((k) => strategyIds[k]) ?? []),
        planMood: d.plan?.mood,
        planNotes: d.plan?.notes ?? "",
        eodWentWell: d.reflection?.wentWell ?? "",
        eodToImprove: d.reflection?.toImprove ?? "",
        eodRating: d.reflection?.rating,
      },
    });
  }

  for (const m of missed) {
    await db.missedTrade.create({
      data: {
        userId: user.id,
        strategyId: strategyIds[m.strategy],
        date: fromIST(m.dayKey, "10:00"),
        symbol: m.symbol,
        reason: m.reason,
        hypotheticalPnl: m.hypotheticalPnl,
      },
    });
  }

  console.log(
    `[seed] gross ₹${Math.round(story.gross)}, charges ₹${Math.round(story.charges)} (${story.chargesPct.toFixed(0)}% of gross), net ₹${Math.round(story.net)}`,
  );
  console.log(
    `[seed] ${closed.length} trades over ${journal.length} days, ${journal.filter((d) => d.plan).length} plans, ${missed.length} missed trades.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
