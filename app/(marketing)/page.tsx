import {
  Aperture,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Crown,
  Dices,
  FileUp,
  GitCompare,
  Heart,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { FlipCards, type TellCard } from "@/components/landing/FlipCards";
import { GameProvider, Watch } from "@/components/landing/GameProvider";
import { Hud } from "@/components/landing/Hud";
import { SlotMachine, type Reading, type SymbolKey } from "@/components/landing/SlotMachine";
import { Trophies } from "@/components/landing/Trophies";
import { APP_NAME, DISCLAIMER, SCORE_NAME, TAGLINE } from "@/config/brand";
import { db } from "@/lib/db";
import { applyFilter } from "@/lib/filters";
import { formatINR, formatINRCompact, istDateKey } from "@/lib/format";
import { loadReportTrades } from "@/lib/report-data";
import { scoreForTrades } from "@/lib/score";
import { computeStats } from "@/lib/stats";
import "./casino.css";

// Reads the live demo journal for the numbers in the games.
export const dynamic = "force-dynamic";

export const metadata = { title: `${APP_NAME}: beat the house. The AI trading journal for Indian traders` };

async function demoNumbers() {
  const user = await db.user.findFirst({ include: { profile: true } });
  if (!user) return null;
  const trades = await loadReportTrades(user.id);
  if (trades.length < 10) return null;
  const s = computeStats(trades);
  const breaches = await db.ruleBreach.findMany({ where: { userId: user.id }, select: { date: true }, distinct: ["date"] });
  const days = [...new Set(trades.map((t) => istDateKey(t.entryAt)))].sort().slice(-20);
  const recent = trades.filter((t) => days.includes(istDateKey(t.entryAt)));
  return {
    s,
    followed: computeStats(applyFilter(trades, { plan: "followed" })),
    broke: computeStats(applyFilter(trades, { plan: "broke" })),
    expiry: computeStats(applyFilter(trades, { expiry: "yes" })),
    normal: computeStats(applyFilter(trades, { expiry: "no" })),
    fomo: computeStats(applyFilter(trades, { emotions: ["FOMO"] })),
    revenge: computeStats(applyFilter(trades, { emotions: ["Revenge"] })),
    over: computeStats(applyFilter(trades, { tag: "Overtrading" })),
    score: scoreForTrades(recent, new Set(breaches.map((b) => b.date)), user.profile?.capital),
  };
}
type Demo = NonNullable<Awaited<ReturnType<typeof demoNumbers>>>;

const money = (n: number) => `${n > 0 ? "+" : ""}${formatINRCompact(n)}`;
const pct = (n: number) => `${n.toFixed(0)}%`;
const tone = (net: number): Reading["tone"] => (net >= 0 ? "good" : "bad");

function readingsFor(d: Demo | null): Record<SymbolKey, Reading> {
  if (!d) {
    const r = (title: string): Reading => ({ title, headline: "Import trades to see yours", detail: "Every symbol reads from your own journal.", tone: "warn" });
    return { spade: r("Followed the plan"), heart: r("FOMO entries"), diamond: r("Revenge trades"), club: r("Overtrading"), seven: r("Expiry days"), rupee: r("The house edge") };
  }
  return {
    spade: { title: "Followed the plan", headline: `${money(d.followed.net)} over ${d.followed.count} trades`, detail: `${pct(d.followed.winRate)} win rate. Process pays.`, tone: tone(d.followed.net) },
    heart: { title: "FOMO entries", headline: `${money(d.fomo.net)} over ${d.fomo.count} trades`, detail: `${pct(d.fomo.winRate)} win rate. Chasing is expensive.`, tone: tone(d.fomo.net) },
    diamond: { title: "Revenge trades", headline: `${money(d.revenge.net)} over ${d.revenge.count} trades`, detail: `${pct(d.revenge.winRate)} win rate. Tilt is the real house edge.`, tone: tone(d.revenge.net) },
    club: { title: "Overtrading", headline: `${money(d.over.net)} over ${d.over.count} trades`, detail: `${pct(d.over.winRate)} win rate. More rolls, more charges.`, tone: tone(d.over.net) },
    seven: { title: "Expiry days", headline: `${pct(d.expiry.winRate)} wins vs ${pct(d.normal.winRate)} on other days`, detail: `${formatINR(d.expiry.expectancy, { signed: true })} per trade on expiry days.`, tone: d.expiry.winRate >= d.normal.winRate ? "good" : "bad" },
    rupee: { title: "The house edge", headline: `Charges ate ${d.s.chargesPctOfGross?.toFixed(0) ?? "—"}% of gross profit`, detail: `${formatINR(d.s.totalCharges)} paid on ${formatINR(d.s.grossPnl)} gross.`, tone: "warn" },
  };
}

function cardsFor(d: Demo | null): TellCard[] {
  const edge = d?.s.chargesPctOfGross?.toFixed(0) ?? "—";
  return [
    {
      rank: "A", suit: "♠", kicker: "THE HOUSE EDGE", tone: "black",
      big: `Charges ate ${edge}%`,
      small: d ? `of the gross profit: ${formatINR(d.s.totalCharges)} paid on ${formatINR(d.s.grossPnl)}.` : "of gross profit goes to brokerage, STT, exchange fees and GST.",
      fix: "Fewer, better trades. Every F&O order pays brokerage, STT, exchange fees and GST, so cut the low-conviction ones first.",
    },
    {
      rank: "K", suit: "♦", kicker: "YOUR TILT", tone: "red",
      big: d ? money(d.revenge.net) : "Revenge costs",
      small: d ? `from ${d.revenge.count} revenge trades, ${pct(d.revenge.winRate)} win rate.` : "Trades taken right after a loss rarely end well.",
      fix: "After a loss, step away. Turn on “stop after 2 losses in a row” in your risk rules and let the tracker flag you the moment you cross it.",
    },
    {
      rank: "Q", suit: "♥", kicker: "YOUR EDGE", tone: "red",
      big: d ? `${money(d.followed.net)} on plan` : "Plan pays",
      small: d ? `vs ${money(d.broke.net)} when the plan was broken (${pct(d.followed.winRate)} vs ${pct(d.broke.winRate)} wins).` : "Trades that follow your playbook outperform the rest.",
      fix: "Write the playbook, tick the checklist on every trade and track how often you follow each rule. The edge is in repeating it.",
    },
  ];
}

const TICKER = [
  "THE HOUSE ALWAYS WINS", "UNLESS YOU JOURNAL", "KNOW YOUR ODDS", "DON'T CHASE LOSSES", "FOLLOW THE PLAN",
  "STOP AFTER TWO LOSSES", "COUNT THE CHARGES", "NO TIPS · NO CALLS · JUST YOUR OWN NUMBERS", "CASH OUT AT THE CUT-OFF",
];

const FLOOR = [
  { icon: Upload, game: "The cashier", title: "Import", text: "Zerodha tradebook in one click. Upstox, Angel One, Groww, Dhan and others through a column mapper. Duplicates skipped, imports undoable." },
  { icon: Dices, game: "Craps", title: "The charges engine", text: "Every roll costs. Brokerage, STT, exchange fees, SEBI fee, stamp duty and GST on every trade, so net P&L is the real one." },
  { icon: Target, game: "Blackjack", title: "Know when to stand", text: "Risk rules for daily loss, trade count and losing streaks, plus playbooks as checklists. Get flagged the moment you bust a limit." },
  { icon: Heart, game: "Poker", title: "Tilt detector", text: "The auto-tagger spots revenge trades, overtrading and late entries, each with the exact reason. Tag your emotions and see what they cost." },
  { icon: BarChart3, game: "Roulette", title: "Where the ball lands", text: "Reports by time of day, weekday, symbol, strategy, emotion and expiry day. Compare any two sets side by side." },
  { icon: Bot, game: "The dealer", title: "AI coach", text: "Ask “do I lose more after 2 PM?” and get answers computed from your real trades. Session and weekly reviews, in English or Hinglish." },
];

const LADDER = [
  { at: 0, name: "Penny Slots", note: "Needs work. Habits are still eating the edge." },
  { at: 35, name: "Low Stakes", note: "Getting consistent. Cut the worst habit first." },
  { at: 50, name: "Mid Stakes", note: "Developing. Rules are starting to stick." },
  { at: 65, name: "High Stakes", note: "Good. Discipline is showing in the numbers." },
  { at: 80, name: "The House", note: "Excellent. The edge belongs to you." },
];

const PLANS = [
  { name: "Free", chip: "#8b95a7", tag: "Starter stack", price: "₹0", period: "forever", blurb: "Start journaling properly.", features: ["Manual trade entry", "1 CSV import a month (Zerodha or any broker)", "True net P&L with Indian charges", "Dashboard, P&L calendar, privacy mode", "Up to 100 trades a month"], cta: "Start free", highlight: false },
  { name: "Pro", chip: "#c0233f", tag: "High-roller seat", price: "₹299", period: "per month · ₹2,499/year", blurb: "For active F&O and intraday traders.", features: ["Unlimited imports and trades", "All reports + Compare", "Playbooks with rule tracking", "Risk rules and breach alerts", `${SCORE_NAME} and Progress`, "AI coach: 50 questions + weekly reviews a month"], cta: "Try Pro free for 14 days", highlight: true },
  { name: "Elite", chip: "#c8860a", tag: "The house", price: "₹699", period: "per month · ₹5,999/year", blurb: "For traders who review every session.", features: ["Everything in Pro", "Unlimited AI coach", "Daily AI session reviews", "AI auto-tagging of mistakes", "Broker auto-sync (when it launches)", "Priority support"], cta: "Go Elite", highlight: false },
];

const RULES = [
  { k: "no tips, no calls.", v: "The coach never says what to buy or sell, never gives targets or predictions. That needs SEBI registration, and it is not what a journal is for." },
  { k: "no invented numbers.", v: "Every figure is computed in code and checked against your own trades before you see it. If one can't be verified, it says so." },
  { k: "no broker login.", v: "You upload the CSV your broker already lets you download. Nothing ever connects to your trading account." },
  { k: "no real-money games.", v: "The chips, jackpots and levels on this page are play money for fun. TradeLens is a journal, not a betting site." },
];

const FAQ = [
  { q: "Is this gambling?", a: "No. The casino is a metaphor: too many traders treat the market like a slot machine, so TradeLens helps you act like the house instead. The chips and jackpots here are play money, and no betting happens anywhere." },
  { q: "Is this investment advice?", a: `No. ${APP_NAME} is an educational journaling tool. It analyses your own past trades and habits. It never recommends securities, targets or market direction.` },
  { q: "Which brokers are supported?", a: "Zerodha tradebooks import directly. Upstox, Angel One, Groww, Dhan and most other brokers work through the CSV column mapper." },
  { q: "Do I need to give my broker password?", a: "No. You upload the tradebook CSV your broker already lets you download. Nothing connects to your trading account." },
  { q: "How accurate is net P&L?", a: "Charges are calculated per trade using current NSE/BSE rates (brokerage, STT, exchange fees, SEBI fee, stamp duty, GST). Your broker's contract note is the final word." },
];

export default async function LandingPage() {
  const demo = await demoNumbers();
  const readings = readingsFor(demo);
  const total = demo?.score?.total;
  const level = total == null ? -1 : LADDER.reduce((acc, l, i) => (total >= l.at ? i : acc), 0);

  return (
    <GameProvider>
      <div className="casino flex min-h-screen flex-col overflow-x-clip">
        {/* Header with HUD */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07090d]/90 backdrop-blur">
          <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="sign flex items-center gap-2 text-lg tracking-tight">
              <Aperture size={22} className="gold" /> {APP_NAME}
            </Link>
            <nav className="hidden items-center gap-5 whitespace-nowrap text-sm text-white/65 xl:flex">
              <a href="#table" className="hover:text-white">The table</a>
              <a href="#tells" className="hover:text-white">Three tells</a>
              <a href="#play" className="hover:text-white">How to play</a>
              <a href="#levels" className="hover:text-white">Levels</a>
              <a href="#rules" className="hover:text-white">House rules</a>
              <a href="#pricing" className="hover:text-white">Chips</a>
            </nav>
            <div className="flex items-center gap-3">
              <Hud />
              <div className="hidden sm:block"><Link href="/dashboard" className="btn-gold whitespace-nowrap px-4 py-1.5 text-sm">Take a seat</Link></div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero */}
          <section id="table" className="felt relative scroll-mt-16 overflow-hidden border-b border-white/10">
            <span className="suit-float left-[6%] top-[12%]" aria-hidden>♠</span>
            <span className="suit-float right-[8%] top-[20%] text-[color:var(--c-ruby)]" style={{ animationDelay: "-2s" }} aria-hidden>♥</span>
            <span className="suit-float bottom-[10%] left-[40%]" style={{ animationDelay: "-4s" }} aria-hidden>♣</span>
            <span className="suit-float bottom-[18%] right-[30%] text-[color:var(--c-ruby)]" style={{ animationDelay: "-1s" }} aria-hidden>♦</span>
            <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
              <div>
                <p className="arcade mb-5 inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/40 px-3 py-2 text-[9px] leading-4 text-white/80">
                  <span aria-hidden className="shrink-0 whitespace-nowrap">♠ ♥ ♦ ♣</span> BUILT FOR NSE &amp; BSE TRADERS
                </p>
                <h1 className="sign text-5xl leading-[1.05] sm:text-6xl">
                  The house <span className="neon-ruby">always</span> wins.
                  <br />
                  <span className="neon-gold">Be the house.</span>
                </h1>
                <p className="mt-6 max-w-xl rounded-xl bg-black/45 p-4 text-base text-white/85 sm:text-lg">
                  Too many traders treat the market like a slot machine. {APP_NAME} reads your own tradebook, shows the house edge
                  (charges, tilt, expiry-day gambles) and coaches your <em>process</em>, never your picks.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/dashboard" className="btn-gold px-6 py-3 text-base">
                    Take a seat <ArrowRight size={18} />
                  </Link>
                  <Link href="/trades/import" className="btn-felt px-6 py-3 text-base">
                    <FileUp size={18} /> Buy in with your tradebook
                  </Link>
                </div>
                <p className="mt-4 text-xs text-white/60">Free to start. No broker login: just upload the CSV you already have.</p>

                {demo && (
                  <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-white/15 bg-black/45 p-3">
                      <dt className="arcade text-[8px] leading-3 text-white/55">HOUSE EDGE</dt>
                      <dd className="sign mt-1 text-2xl gold">{demo.s.chargesPctOfGross?.toFixed(0) ?? "—"}%</dd>
                      <dd className="text-[11px] text-white/55">charges / gross</dd>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-black/45 p-3">
                      <dt className="arcade text-[8px] leading-3 text-white/55">ON PLAN</dt>
                      <dd className="tabular sign mt-1 text-2xl mint">{money(demo.followed.net)}</dd>
                      <dd className="text-[11px] text-white/55">{pct(demo.followed.winRate)} wins</dd>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-black/45 p-3">
                      <dt className="arcade text-[8px] leading-3 text-white/55">{SCORE_NAME.toUpperCase()}</dt>
                      <dd className="sign mt-1 text-2xl">{demo.score?.total ?? "—"}</dd>
                      <dd className="text-[11px] text-white/55">{demo.score?.grade ?? ""}</dd>
                    </div>
                  </dl>
                )}
              </div>

              <SlotMachine readings={readings} />
            </div>
          </section>

          {/* Ticker */}
          <div className="ticker border-b border-white/10 bg-black py-3" aria-hidden>
            <div className="ticker-track arcade text-[10px] text-[color:var(--c-gold)]">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="inline-flex items-center gap-10">{t} <span className="ruby">♦</span></span>
              ))}
            </div>
          </div>

          {/* Three tells */}
          <section id="tells" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
            <p className="arcade text-[10px] leading-4 mint">THE FINDING</p>
            <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">One journal. <span className="gold">Three tells.</span></h2>
            <p className="mt-3 max-w-2xl text-white/70">
              Every trader leaks money in a few repeatable ways. {APP_NAME} finds yours and deals them face-up. Flip a card to see the fix.
            </p>
            <div className="mt-10">
              <FlipCards cards={cardsFor(demo)} />
            </div>
            <p className="mt-6 text-center text-[11px] text-white/50">Live from the demo journal: a sample trader with 60 days of trades.</p>
          </section>

          {/* How to play */}
          <section id="play" className="border-y border-white/10 bg-black/40 py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <p className="arcade text-[10px] leading-4 mint">HOW TO PLAY</p>
              <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">Buy in. Play. <span className="gold">Cash out.</span></h2>
              <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
                {[
                  { n: "01", t: "Buy in", d: "Upload your Zerodha tradebook or any broker CSV. Trades, charges and net P&L are ready in seconds.", time: "~30 SEC", chip: "#c0233f" },
                  { n: "02", t: "Play your session", d: "Tag how you felt, tick your playbook, and let the coach flag tilt and rule breaks while the day is fresh.", time: "~1 MIN A DAY", chip: "#1a8f5a" },
                  { n: "03", t: "Cash out the lesson", d: "Weekly review: top 3 strengths, top 3 mistakes, 3 rules for next week. Watch your Lens Score climb.", time: "EVERY WEEKEND", chip: "#c8860a" },
                ].map((s) => (
                  <div key={s.n} className="panel relative p-6">
                    <div className="chip absolute -top-6 right-5" style={{ "--chip": s.chip } as React.CSSProperties}>{s.n}</div>
                    <h3 className="sign pr-14 text-2xl leading-8">{s.t}</h3>
                    <p className="mt-2 text-sm text-white/70">{s.d}</p>
                    <span className="arcade mt-4 inline-block rounded-md bg-white/10 px-2.5 py-1.5 text-[9px] leading-3 gold">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Casino floor = features */}
          <section id="floor" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
            <p className="arcade text-[10px] leading-4 mint">THE CASINO FLOOR</p>
            <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">Every table is a <span className="gold">tool</span>.</h2>
            <p className="mt-3 max-w-2xl text-white/70">Same game, played for real insight instead of luck. Each table below is a part of the journal.</p>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FLOOR.map((f) => (
                <div key={f.title} className="panel p-5 transition-transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--c-gold)]/15 text-[color:var(--c-gold)]"><f.icon size={22} /></span>
                    <span className="arcade text-[9px] uppercase leading-4 text-white/50">{f.game}</span>
                  </div>
                  <h3 className="sign mt-4 text-xl leading-7">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-white/70">{f.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Levels + trophies */}
          <section id="levels" className="felt scroll-mt-16 border-y border-white/10 py-20">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-2">
              <div>
                <p className="arcade text-[10px] leading-4 mint">CLIMB THE TABLES</p>
                <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">Level up your <span className="gold">discipline</span>.</h2>
                <p className="mt-3 text-white/75">
                  Your {SCORE_NAME} (0 to 100) blends win rate, profit factor, drawdown, consistency and plan adherence. Each band unlocks a higher table.
                </p>
                <ol className="mt-6 space-y-2">
                  {[...LADDER].reverse().map((l, ri) => {
                    const i = LADDER.length - 1 - ri;
                    const here = i === level;
                    return (
                      <li key={l.name} className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${here ? "rung-active" : "border-white/10 bg-black/30"}`}>
                        <span className="arcade w-12 shrink-0 text-[10px] text-white/55">{l.at}+</span>
                        <span className="min-w-0 flex-1">
                          <span className="sign flex items-center gap-2 text-base">{i === LADDER.length - 1 && <Crown size={16} className="gold" />}{l.name}</span>
                          <span className="block text-xs text-white/60">{l.note}</span>
                        </span>
                        {here && demo?.score && <span className="arcade shrink-0 rounded-md bg-[color:var(--c-gold)] px-2 py-1 text-[8px] leading-3 text-[#2a1a00]">DEMO TRADER · {demo.score.total}</span>}
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div>
                <p className="arcade text-[10px] leading-4 mint">TROPHY SHELF</p>
                <h2 className="sign mt-2 text-3xl leading-tight">Earn chips as you explore.</h2>
                <p className="mb-5 mt-2 text-sm text-white/70">Try it: the page keeps score while you play. Nothing is saved and no account is needed.</p>
                <Trophies />
              </div>
            </div>
          </section>

          {/* The dealer: AI coach */}
          <Watch id="dealer" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6" data-section="dealer">
            <div id="dealer" className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
              <div>
                <p className="arcade text-[10px] leading-4 mint">MEET THE DEALER</p>
                <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">A coach for your <span className="gold">process</span>, not your picks.</h2>
                <p className="mt-3 text-white/70">
                  It reads your journal, not the market. Every number it quotes is computed from your own trades and checked before you see it.
                  Beginners get plain explanations; experts get the data. English or Hinglish.
                </p>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Ask your journal anything: “Do I lose more after 2 PM?”",
                    "Session review: your pre-market plan vs what you actually did",
                    "Weekly review: top 3 strengths, top 3 mistakes, 3 rules for next week",
                    "First-import analysis the moment you upload a tradebook",
                  ].map((x) => (
                    <li key={x} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 mint" /> {x}</li>
                  ))}
                </ul>
                <p className="mt-6 flex items-start gap-2 rounded-lg border border-white/15 bg-black/40 p-3 text-xs text-white/65">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 mint" />
                  Ask the dealer for a tip and it politely folds. Targets and predictions need SEBI registration, and that is not what a journal is for.
                </p>
              </div>
              <div className="panel-gold p-5 shadow-2xl">
                <div className="mb-3 flex justify-end">
                  <span className="rounded-xl bg-[color:var(--c-gold)]/15 px-3.5 py-2 text-sm">What&apos;s my win rate on expiry days?</span>
                </div>
                <div className="rounded-xl bg-white/[0.06] px-3.5 py-3 text-sm">
                  {demo ? (
                    <p>
                      On expiry days you won <strong>{pct(demo.expiry.winRate)}</strong> of {demo.expiry.count} trades and averaged{" "}
                      <strong>{formatINR(demo.expiry.expectancy, { signed: true })}</strong> per trade, against {pct(demo.normal.winRate)} and{" "}
                      {formatINR(demo.normal.expectancy, { signed: true })} on other days.
                    </p>
                  ) : (
                    <p>On expiry days you win less often and lose more per trade than on normal days.</p>
                  )}
                  <p className="mt-2">Try this: on expiry days, trade 1 lot only and stop after your first loss.</p>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--c-mint)]/10 px-2 py-0.5 text-xs mint">
                    <ShieldCheck size={13} /> Figures verified against your data
                  </span>
                  <p className="mt-2 text-[11px] text-white/50">Example built from the demo journal&apos;s real numbers.</p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
                  <ShieldAlert size={14} /> Ask for a tip and it politely says no.
                </div>
              </div>
            </div>
          </Watch>

          {/* House rules = what we won't pretend */}
          <Watch id="rules" className="border-y border-white/10 bg-black/40 py-20" data-section="rules">
            <div id="rules" className="mx-auto max-w-6xl scroll-mt-16 px-4 sm:px-6">
              <p className="arcade text-[10px] leading-4 mint">HOUSE RULES</p>
              <h2 className="sign mt-2 text-4xl leading-tight sm:text-5xl">What we won&apos;t <span className="ruby">pretend</span>.</h2>
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
                {RULES.map((r) => (
                  <div key={r.k} className="panel flex gap-4 p-5">
                    <Lock size={20} className="mt-1 shrink-0 gold" />
                    <div>
                      <h3 className="sign text-xl leading-7">{r.k}</h3>
                      <p className="mt-1 text-sm text-white/70">{r.v}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Watch>

          {/* Pricing = chips */}
          <Watch id="chips" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6" data-section="chips">
            <div id="pricing">
              <p className="arcade text-center text-[10px] leading-4 mint">THE CASHIER</p>
              <h2 className="sign mt-2 text-center text-4xl leading-tight sm:text-5xl">Pick your <span className="gold">chips</span>.</h2>
              <p className="mt-3 text-center text-white/70">Simple pricing in rupees. Start free. Upgrade when the journal starts paying for itself.</p>
              <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
                {PLANS.map((p) => (
                  <div key={p.name} className={`relative p-6 pt-10 ${p.highlight ? "panel-gold ring-2 ring-[color:var(--c-gold)]/60" : "panel"}`}>
                    <div className="chip absolute -top-8 left-6" style={{ "--chip": p.chip } as React.CSSProperties}>{p.name.slice(0, 1)}</div>
                    {p.highlight && <span className="arcade absolute -top-3 right-5 rounded-md bg-[color:var(--c-gold)] px-2.5 py-1.5 text-[8px] leading-3 text-[#2a1a00]">MOST POPULAR</span>}
                    <div className="arcade text-[9px] uppercase leading-4 text-white/55">{p.tag}</div>
                    <h3 className="sign text-2xl leading-8">{p.name}</h3>
                    <p className="text-sm text-white/65">{p.blurb}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="tabular text-4xl font-bold">{p.price}</span>
                      <span className="text-sm text-white/60">{p.period}</span>
                    </div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 mint" /> {f}</li>
                      ))}
                    </ul>
                    <Link href="/dashboard" className={`${p.highlight ? "btn-gold" : "btn-felt"} mt-6 w-full`}>{p.cta}</Link>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-center text-xs text-white/55">Prices include GST. Display only in this preview: no payment is taken.</p>
            </div>
          </Watch>

          {/* Next tables */}
          <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
            <div className="panel p-6">
              <h2 className="flex items-center gap-2 font-semibold"><GitCompare size={18} className="gold" /> New tables opening soon</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-white/65 sm:grid-cols-2 lg:grid-cols-4">
                <p><span className="text-white">Broker auto-sync</span>: Kite Connect, Upstox and Dhan APIs, no CSV needed.</p>
                <p><span className="text-white">Trade replay</span>: see the chart around every entry and exit.</p>
                <p><span className="text-white">Mentor sharing</span>: let a coach review your journal, read-only.</p>
                <p><span className="text-white">Mobile app</span>: journal your trade the moment you exit.</p>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 pb-20 sm:px-6">
            <h2 className="sign text-3xl leading-tight">Questions at the <span className="gold">table</span></h2>
            <div className="panel mt-6 divide-y divide-white/10">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="cursor-pointer list-none font-medium">
                    <span className="flex items-center justify-between gap-4">{f.q}<span className="gold transition-transform group-open:rotate-45">+</span></span>
                  </summary>
                  <p className="mt-2 text-sm text-white/70">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="felt border-t border-white/10 py-20 text-center">
            <div className="mx-auto max-w-3xl px-4">
              <p className="arcade text-[10px] leading-4 mint">LAST CALL</p>
              <h2 className="sign mt-3 text-5xl leading-tight sm:text-6xl"><span className="neon-gold">Ready to be the house?</span></h2>
              <p className="mx-auto mt-4 max-w-xl text-white/75">No sign-up. Open the demo journal in one click, or upload your own tradebook and see your real edge.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/dashboard" className="btn-gold px-7 py-3 text-base"><Sparkles size={18} /> Take a seat</Link>
                <Link href="/trades/import" className="btn-felt px-7 py-3 text-base"><FileUp size={18} /> Buy in with your tradebook</Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 bg-black px-4 py-8 text-center text-xs text-white/55">
          <p className="sign mb-1 flex items-center justify-center gap-2 text-sm text-white"><Aperture size={16} className="gold" /> {APP_NAME}</p>
          <p>{TAGLINE}</p>
          <p className="mt-2">{DISCLAIMER} Not affiliated with any broker or exchange. All times IST.</p>
          <p className="mt-1">The casino theme is a metaphor. No betting, no real-money games and no tips anywhere on this site.</p>
        </footer>
      </div>
    </GameProvider>
  );
}
