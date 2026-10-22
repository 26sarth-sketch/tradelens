// Deterministic demo-data generator for the seed script.
//
// Simulates ~60 trading days of a beginner-to-intermediate trader (mostly NIFTY /
// BANKNIFTY options, some intraday equity) with patterns baked in for the demo:
//   1. Revenge trades: re-entering minutes after a big loss, one lot bigger, mostly lose
//   2. Expiry days (NIFTY Tuesdays): more trades, cheaper premiums, worse results
//   3. After 2 PM: lower win rate and bigger losses
//   4. Charges: many small option scalps, so charges eat a big share of gross profit
//   5. Followed plan: higher win rate, losses capped at the stop-loss
// Same seed + same date => same data. The seed script searches seeds until the
// story criteria in `demoStory()` hold (see prisma/seed.ts).

import { fromIST, istDateKey } from "@/lib/format";
import { isExpiryDay, nextExpiry } from "@/lib/expiry";
import type { RawTrade } from "@/lib/trades";
import type { Emotion } from "@/lib/types";

// ─── Deterministic randomness ─────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(1);
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rand() < p;
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const tick = (n: number) => Math.max(0.05, Math.round(n * 20) / 20); // ₹0.05 tick

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyKey = "ORB" | "VWAP" | "EXPIRY";
export type TagKey = "REVENGE" | "OVERTRADING" | "HELD_LOSER" | "CHASED" | "A_PLUS" | "MOVED_SL";

export type DemoTrade = RawTrade & {
  strategy?: StrategyKey;
  emotionBefore?: Emotion;
  emotionAfter?: Emotion;
  followedPlan?: boolean;
  tags: TagKey[];
  notes?: string;
  highPrice?: number;
  lowPrice?: number;
};

export type DemoDay = {
  dayKey: string;
  plan?: { maxTrades: number; maxLoss: number; strategies: StrategyKey[]; mood: Emotion; notes: string };
  notes?: string;
  reflection?: { wentWell: string; toImprove: string; rating: number };
};

export type DemoMissed = { dayKey: string; strategy: StrategyKey; symbol: string; reason: string; hypotheticalPnl: number };

// ─── Calendar ─────────────────────────────────────────────────────────────────

/** The last `n` weekdays ending on `today` (IST). Exchange holidays are ignored. */
export function tradingDays(today: Date, n: number): string[] {
  const days: string[] = [];
  const d = new Date(`${istDateKey(today)}T00:00:00Z`);
  while (days.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const T = (h: number, m: number) => h * 60 + m;

// ─── Instruments ──────────────────────────────────────────────────────────────

const EQUITIES = [
  { symbol: "RELIANCE", price: 1420 },
  { symbol: "HDFCBANK", price: 1960 },
  { symbol: "ICICIBANK", price: 1380 },
  { symbol: "INFY", price: 1530 },
  { symbol: "TCS", price: 3150 },
  { symbol: "SBIN", price: 870 },
  { symbol: "TATAMOTORS", price: 690 },
] as const;

const NOTES_WIN = [
  "Waited for the candle close above the range. Clean entry.",
  "Took partial at 1R, trailed the rest. Felt in control.",
  "Setup matched the checklist. Exited at target.",
  "Patient entry at VWAP retest.",
];
const NOTES_LOSS = [
  "Entered early before confirmation.",
  "Market reversed right after entry. SL hit.",
  "Chased the move after missing the first leg.",
  "Ignored the 2 PM rule. Choppy price action.",
];
const NOTES_REVENGE = [
  "Wanted to make back the last loss quickly. Doubled size.",
  "Angry after the SL hit. Jumped back in without a setup.",
];

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateDemo(today: Date, seed = 1) {
  rand = mulberry32(seed);
  const days = tradingDays(today, 60);
  const trades: DemoTrade[] = [];
  const journal: DemoDay[] = [];
  const missed: DemoMissed[] = [];

  let nifty = 24_650;
  let bankNifty = 53_400;
  const eq = Object.fromEntries(EQUITIES.map((e) => [e.symbol, e.price as number]));

  for (const [dayIndex, dayKey] of days.entries()) {
    // The trader improves as they keep journaling: 0 → 1 over the 60 days.
    const progress = dayIndex / Math.max(1, days.length - 1);
    // Index drift so strikes look realistic over time.
    nifty = Math.round(nifty * (1 + between(-0.008, 0.009)));
    bankNifty = Math.round(bankNifty * (1 + between(-0.009, 0.01)));
    for (const e of EQUITIES) eq[e.symbol] = eq[e.symbol] * (1 + between(-0.012, 0.013));

    const expiry = isExpiryDay("NIFTY", dayKey);
    const hasPlan = chance(0.55 + 0.35 * progress);
    // Days with a written plan tend to be disciplined days.
    // Expiry days pull in more impulsive, zero-day option trades.
    const disciplined = expiry ? chance(0.25 + 0.3 * progress) : hasPlan ? chance(0.55 + 0.35 * progress) : chance(0.2 + 0.25 * progress);
    const planMaxTrades = 3;
    const dayStart = fromIST(dayKey, "12:00");

    const day: DemoDay = { dayKey };
    if (hasPlan) {
      day.plan = {
        maxTrades: planMaxTrades,
        maxLoss: 4000,
        strategies: expiry ? ["EXPIRY", "ORB"] : ["ORB", "VWAP"],
        mood: pick(["Calm", "Confident", "Calm", "Fearful", "Bored"] as const),
        notes: expiry ? "Expiry day. Small size, no trades after 2 PM." : "Only A+ setups. Respect SL.",
      };
    }

    let cursor = T(9, 16) + int(0, 12);
    let count = 0;
    let dayNet = 0;
    // Disciplined days respect the demo trader's risk rules (3 trades, stop after 2 losses, nothing after 14:00).
    const target = disciplined ? int(2, 3) : expiry ? int(4, 7) : int(2, 4);
    let lossStreak = 0;

    while (count < target && cursor < (disciplined ? T(14, 0) : T(15, 5))) {
      const late = cursor >= T(14, 0);
      const followed = disciplined && !late && chance(0.85);
      const overLimit = hasPlan && count >= planMaxTrades;
      const t = makeTrade({ dayKey, minute: cursor, expiry, late, followed, nifty, bankNifty, eq, dayStart });
      if (overLimit) {
        t.followedPlan = false;
        if (chance(0.5)) t.tags.push("OVERTRADING");
      }
      trades.push(t);
      count++;
      const net = approxNet(t);
      dayNet += net;
      cursor = minutesOf(t.exitAt) + int(8, 55);

      // Revenge trade: big loss → re-enter within minutes, one lot bigger.
      if (t.segment === "OPT" && net < -1200 && chance(0.6) && cursor < T(15, 10)) {
        const revMinute = minutesOf(t.exitAt) + int(2, 9);
        const r = makeRevenge(t, dayKey, revMinute, dayStart);
        trades.push(r);
        count++;
        dayNet += approxNet(r);
        cursor = minutesOf(r.exitAt) + int(10, 40);
      }
      lossStreak = net <= 0 ? lossStreak + 1 : 0;
      if (disciplined && (dayNet < -4000 || lossStreak >= 2)) break; // respected daily loss and losing-streak rules
    }

    // Undisciplined afternoons: a "boredom" trade after 2 PM.
    if (!disciplined && chance(expiry ? 0.75 : 0.5)) {
      const minute = Math.max(cursor, T(14, 0) + int(0, 50));
      if (minute < T(15, 5)) {
        trades.push(makeTrade({ dayKey, minute, expiry, late: true, followed: false, nifty, bankNifty, eq, dayStart }));
      }
    }

    if (chance(0.35)) day.notes = dayNet >= 0 ? "Good day. Stuck to the process." : "Rough day. Need to slow down after a loss.";
    if (hasPlan && chance(0.6)) {
      day.reflection = dayNet >= 0
        ? { wentWell: "Followed my entry rules and sized correctly.", toImprove: "Exit winners a bit later.", rating: int(4, 5) }
        : { wentWell: "Logged every trade.", toImprove: "Stop after two losses. No trades after 2 PM.", rating: int(1, 3) };
    }
    journal.push(day);

    if (chance(0.12)) {
      missed.push({
        dayKey,
        strategy: pick(["ORB", "VWAP"] as const),
        symbol: chance(0.6) ? "NIFTY" : "BANKNIFTY",
        reason: pick(["Hesitated after the previous loss", "Was away from the screen", "Waited for more confirmation"]),
        hypotheticalPnl: Math.round(between(800, 3500)),
      });
    }
  }

  trades.push(...makeDeliveryTrades(days, eq));
  return { trades, journal, missed };
}

// ─── Trade builders ───────────────────────────────────────────────────────────

type Ctx = {
  dayKey: string;
  minute: number;
  expiry: boolean;
  late: boolean;
  followed: boolean;
  nifty: number;
  bankNifty: number;
  eq: Record<string, number>;
  dayStart: Date;
};

function minutesOf(d: Date) {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** Rough net for pattern decisions (the real figure comes from the charges engine). */
function approxNet(t: DemoTrade) {
  const sign = t.direction === "LONG" ? 1 : -1;
  return (t.avgExit - t.avgEntry) * sign * t.qty - 60;
}

function emotionBefore(followed: boolean): Emotion {
  return followed ? pick(["Calm", "Confident", "Calm"] as const) : pick(["FOMO", "Bored", "Fearful", "Confident"] as const);
}

function makeTrade(c: Ctx): DemoTrade {
  const roll = rand();
  if (roll < 0.8) return makeIndexOption(c);
  if (roll < 0.97) return makeEquityIntraday(c);
  return makeIndexFuture(c);
}

function winProbability(c: Pick<Ctx, "followed" | "late" | "expiry">) {
  let p = 0.58;
  p += c.followed ? 0.15 : -0.05;
  if (c.late) p -= 0.2;
  if (c.expiry) p -= 0.15;
  return Math.max(0.12, Math.min(0.8, p));
}

function makeIndexOption(c: Ctx): DemoTrade {
  const isNifty = chance(c.expiry ? 0.9 : 0.55);
  const underlying = isNifty ? "NIFTY" : "BANKNIFTY";
  const spot = isNifty ? c.nifty : c.bankNifty;
  const step = isNifty ? 50 : 100;
  const lotSize = isNifty ? 65 : 30;
  const optionType = chance(0.5) ? "CE" : "PE";
  const strike = Math.round(spot / step) * step + (optionType === "CE" ? 1 : -1) * step * int(0, 2);

  // Expiry-day NIFTY premiums are cheap and swing hard.
  const cheap = c.expiry && isNifty;
  const entry = tick(cheap ? between(18, 70) : isNifty ? between(85, 190) : between(220, 460));
  const lots = c.followed ? 1 : int(1, 2) + (c.expiry && chance(0.5) ? 1 : 0);

  const win = chance(winProbability(c));
  let move: number;
  const tags: TagKey[] = [];
  if (win) {
    move = between(0.1, 0.3) * (c.followed ? 1.2 : 0.9);
  } else if (c.followed) {
    move = -between(0.1, 0.19); // stop-loss respected
  } else {
    move = -between(0.1, 0.24) * (c.late ? 1.3 : 1) * (cheap ? 1.8 : 1);
    if (chance(0.3)) {
      move -= between(0.08, 0.18); // held the loser
      if (chance(0.5)) tags.push("HELD_LOSER");
    }
  }
  move = Math.max(move, -0.85);
  const exit = tick(entry * (1 + move));
  const hold = win ? int(4, 35) : int(8, 65);

  const t: DemoTrade = {
    exchange: "NSE",
    segment: "OPT",
    underlying,
    optionType,
    strike,
    expiry: nextExpiry(underlying, c.dayStart),
    lotSize,
    direction: "LONG",
    qty: lots * lotSize,
    avgEntry: entry,
    avgExit: exit,
    entryAt: fromIST(c.dayKey, hhmm(c.minute)),
    exitAt: fromIST(c.dayKey, hhmm(Math.min(c.minute + hold, T(15, 25)))),
    followedPlan: c.followed,
    emotionBefore: emotionBefore(c.followed),
    emotionAfter: win ? pick(["Confident", "Calm"] as const) : pick(["Fearful", "Calm", "Fearful"] as const),
    tags,
  };
  return finish(t, c, win);
}

function makeIndexFuture(c: Ctx): DemoTrade {
  const direction = chance(0.55) ? "LONG" : "SHORT";
  const entry = c.nifty + int(-40, 40);
  const win = chance(winProbability(c));
  const points = win ? between(25, 110) : -between(30, c.followed ? 60 : 130);
  const exit = Math.round(entry + (direction === "LONG" ? points : -points));
  const t: DemoTrade = {
    exchange: "NSE",
    segment: "FUT",
    underlying: "NIFTY",
    expiry: nextExpiry("BANKNIFTY", c.dayStart), // monthly contract (last Tuesday)
    lotSize: 65,
    direction,
    qty: 65,
    avgEntry: entry,
    avgExit: exit,
    entryAt: fromIST(c.dayKey, hhmm(c.minute)),
    exitAt: fromIST(c.dayKey, hhmm(Math.min(c.minute + int(15, 90), T(15, 25)))),
    followedPlan: c.followed,
    emotionBefore: emotionBefore(c.followed),
    emotionAfter: win ? "Confident" : "Fearful",
    tags: [],
  };
  return finish(t, c, win);
}

function makeEquityIntraday(c: Ctx): DemoTrade {
  const e = pick(EQUITIES);
  const price = tick(c.eq[e.symbol]);
  const qty = Math.max(1, Math.round(between(80_000, 2_00_000) / price));
  const direction = chance(0.6) ? "LONG" : "SHORT";
  const win = chance(winProbability(c));
  const pct = win ? between(0.003, 0.012) : -between(0.003, c.followed ? 0.007 : 0.014);
  const exit = tick(price * (1 + (direction === "LONG" ? pct : -pct)));
  const t: DemoTrade = {
    exchange: "NSE",
    segment: "EQ_INTRADAY",
    underlying: e.symbol,
    direction,
    qty,
    avgEntry: price,
    avgExit: exit,
    entryAt: fromIST(c.dayKey, hhmm(c.minute)),
    exitAt: fromIST(c.dayKey, hhmm(Math.min(c.minute + int(10, 120), T(15, 15)))),
    followedPlan: c.followed,
    emotionBefore: emotionBefore(c.followed),
    emotionAfter: win ? "Calm" : "Fearful",
    tags: [],
  };
  return finish(t, c, win);
}

/** Plan fields, strategy, notes and intra-trade high/low common to every trade. */
function finish(t: DemoTrade, c: Ctx, win: boolean): DemoTrade {
  const long = t.direction === "LONG";
  const riskPct = t.segment === "OPT" ? 0.2 : t.segment === "FUT" ? 0.0025 : 0.007;
  const sign = long ? 1 : -1;

  if (c.followed || chance(0.25)) {
    t.plannedSL = tick(t.avgEntry * (1 - sign * riskPct));
    t.plannedTarget = tick(t.avgEntry * (1 + sign * riskPct * 2));
  }
  if (c.followed) {
    t.strategy = c.expiry && t.segment === "OPT" ? "EXPIRY" : c.minute < T(9, 50) ? "ORB" : "VWAP";
    if (win && chance(0.35)) t.tags.push("A_PLUS");
  } else if (chance(0.45)) {
    t.strategy = pick(["ORB", "VWAP"] as const);
  }
  if (!c.followed && t.emotionBefore === "FOMO" && chance(0.6)) t.tags.push("CHASED");
  if (!c.followed && !win && t.plannedSL != null && chance(0.25)) t.tags.push("MOVED_SL");

  // Manual high/low for ~60% of trades (feeds MFE/MAE later).
  if (chance(0.6)) {
    const hi = Math.max(t.avgEntry, t.avgExit);
    const lo = Math.min(t.avgEntry, t.avgExit);
    const span = Math.abs(t.avgEntry - t.avgExit) + t.avgEntry * 0.02;
    t.highPrice = tick(hi + span * between(0.05, 0.6));
    t.lowPrice = tick(Math.max(0.05, lo - span * between(0.05, 0.5)));
  }
  if (chance(0.3)) t.notes = win ? pick(NOTES_WIN) : pick(NOTES_LOSS);
  return t;
}

/** Revenge trades are only generated after option losses (premium re-entry). */
function makeRevenge(prev: DemoTrade, dayKey: string, minute: number, dayStart: Date): DemoTrade {
  const win = chance(0.27);
  const entry = tick(prev.avgExit * between(0.9, 1.15));
  const move = win ? between(0.06, 0.18) : -between(0.1, 0.26);
  const t: DemoTrade = {
    ...prev,
    // Flip CE/PE half the time: "it must reverse now".
    optionType: prev.optionType && chance(0.5) ? (prev.optionType === "CE" ? "PE" : "CE") : prev.optionType,
    expiry: prev.segment === "OPT" ? nextExpiry(prev.underlying, dayStart) : prev.expiry,
    qty: prev.qty + (prev.lotSize ?? prev.qty), // one lot bigger: "win it back faster"
    avgEntry: entry,
    avgExit: tick(prev.direction === "LONG" ? entry * (1 + move) : entry * (1 - move)),
    entryAt: fromIST(dayKey, hhmm(minute)),
    exitAt: fromIST(dayKey, hhmm(Math.min(minute + int(5, 30), T(15, 28)))),
    plannedSL: null,
    plannedTarget: null,
    strategy: undefined,
    followedPlan: false,
    emotionBefore: "Revenge",
    emotionAfter: win ? "Confident" : "Fearful",
    tags: chance(0.6) ? ["REVENGE"] : [], // the rest are left for the AI auto-tagger
    notes: chance(0.5) ? pick(NOTES_REVENGE) : undefined,
    highPrice: undefined,
    lowPrice: undefined,
  };
  return t;
}

function makeDeliveryTrades(days: string[], eq: Record<string, number>): DemoTrade[] {
  const picks = [
    { symbol: "INFY", buyIdx: 5, sellIdx: 19, move: 0.06 },
    { symbol: "HDFCBANK", buyIdx: 14, sellIdx: 33, move: -0.035 },
    { symbol: "TCS", buyIdx: 30, sellIdx: 52, move: 0.045 },
  ];
  return picks.map((p) => {
    const price = tick(eq[p.symbol] * 0.97);
    const qty = Math.round(1_00_000 / price);
    return {
      exchange: "NSE",
      segment: "EQ_DELIVERY",
      underlying: p.symbol,
      direction: "LONG",
      qty,
      avgEntry: price,
      avgExit: tick(price * (1 + p.move)),
      entryAt: fromIST(days[p.buyIdx], "10:05"),
      exitAt: fromIST(days[p.sellIdx], "13:40"),
      followedPlan: true,
      emotionBefore: "Calm",
      emotionAfter: p.move > 0 ? "Confident" : "Calm",
      tags: [],
      notes: "Swing position based on weekly chart.",
    } satisfies DemoTrade;
  });
}

// ─── Story check ──────────────────────────────────────────────────────────────

type Built = { netPnl: number; grossPnl: number; totalCharges: number; isExpiryDay: boolean; entryAt: Date };

/** Summary numbers the demo relies on, computed from built trades. */
export function demoStory(src: DemoTrade[], built: Built[]) {
  const avg = (idx: number[]) => (idx.length ? idx.reduce((s, i) => s + built[i].netPnl, 0) / idx.length : 0);
  const winRate = (idx: number[]) => (idx.length ? idx.filter((i) => built[i].netPnl > 0).length / idx.length : 0);
  const all = built.map((_, i) => i);
  const where = (f: (i: number) => boolean) => all.filter(f);
  const late = (i: number) => minutesOf(built[i].entryAt) >= T(14, 0);

  const gross = built.reduce((s, t) => s + t.grossPnl, 0);
  const charges = built.reduce((s, t) => s + t.totalCharges, 0);
  return {
    gross,
    charges,
    net: gross - charges,
    chargesPct: gross > 0 ? (charges / gross) * 100 : Infinity,
    followedWin: winRate(where((i) => src[i].followedPlan === true)),
    notFollowedWin: winRate(where((i) => src[i].followedPlan === false)),
    expiryAvg: avg(where((i) => built[i].isExpiryDay)),
    nonExpiryAvg: avg(where((i) => !built[i].isExpiryDay)),
    lateAvg: avg(where(late)),
    earlyAvg: avg(where((i) => !late(i))),
    revengeWin: winRate(where((i) => src[i].emotionBefore === "Revenge")),
  };
}

/** The story the demo script tells. All must hold. */
export function isGoodStory(s: ReturnType<typeof demoStory>) {
  return (
    s.gross >= 35_000 && s.gross <= 90_000 && // profitable before charges…
    s.chargesPct >= 35 && s.chargesPct <= 70 && // …but charges eat a big share
    s.followedWin - s.notFollowedWin >= 0.25 &&
    s.expiryAvg < s.nonExpiryAvg - 600 &&
    s.lateAvg < s.earlyAvg - 800 &&
    s.revengeWin <= 0.3
  );
}
