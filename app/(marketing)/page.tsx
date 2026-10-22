import {
  Aperture,
  ArrowRight,
  BarChart3,
  Bot,
  Calculator,
  Check,
  FileUp,
  GitCompare,
  LayoutDashboard,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { APP_NAME, DISCLAIMER, SCORE_NAME, TAGLINE } from "@/config/brand";
import { applyFilter } from "@/lib/filters";
import { formatINR, formatINRCompact, istDateKey } from "@/lib/format";
import { loadReportTrades } from "@/lib/report-data";
import { scoreForTrades } from "@/lib/score";
import { computeStats } from "@/lib/stats";
import { db } from "@/lib/db";

// Reads the live demo journal for the hero numbers.
export const dynamic = "force-dynamic";

export const metadata = { title: `${APP_NAME}: the AI trading journal for Indian traders` };

async function demoNumbers() {
  const user = await db.user.findFirst({ include: { profile: true } });
  if (!user) return null;
  const trades = await loadReportTrades(user.id);
  if (trades.length < 10) return null;
  const s = computeStats(trades);
  const followed = computeStats(applyFilter(trades, { plan: "followed" }));
  const broke = computeStats(applyFilter(trades, { plan: "broke" }));
  const breaches = await db.ruleBreach.findMany({ where: { userId: user.id }, select: { date: true }, distinct: ["date"] });
  const days = [...new Set(trades.map((t) => istDateKey(t.entryAt)))].sort().slice(-20);
  const recent = trades.filter((t) => days.includes(istDateKey(t.entryAt)));
  const score = scoreForTrades(recent, new Set(breaches.map((b) => b.date)), user.profile?.capital);
  const expiry = computeStats(applyFilter(trades, { expiry: "yes" }));
  const normal = computeStats(applyFilter(trades, { expiry: "no" }));
  return { s, followed, broke, score, expiry, normal };
}

const FEATURES = [
  {
    icon: FileUp,
    title: "Import from any Indian broker",
    text: "Zerodha tradebook in one click. Upstox, Angel One, Groww, Dhan and others through a column mapper. Fills become complete trades, duplicates are skipped.",
  },
  {
    icon: Calculator,
    title: "True net P&L, after Indian charges",
    text: "Brokerage, STT, exchange fees, SEBI fee, stamp duty and GST on every trade. See exactly how much of your profit the charges eat.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard that tells the truth",
    text: "Win rate, profit factor, expectancy and drawdown in ₹, % of capital, R-multiple or index points. P&L calendar, equity curve, privacy mode.",
  },
  {
    icon: BarChart3,
    title: "Reports that find your leaks",
    text: "By time of day, weekday, symbol, strategy, tag, emotion, and expiry vs normal days. Compare any two sets side by side.",
  },
  {
    icon: Target,
    title: "Playbooks and risk rules",
    text: "Write your strategies as checklists, track how often you follow each rule, and get flagged the moment you break your daily limits.",
  },
  {
    icon: Bot,
    title: "AI coach that knows your journal",
    text: "Ask “what's my win rate on expiry days?” and get answers computed from your real trades. Session and weekly reviews with three rules for next week.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    blurb: "Start journaling properly.",
    features: ["Manual trade entry", "1 CSV import a month (Zerodha or any broker)", "True net P&L with Indian charges", "Dashboard, P&L calendar, privacy mode", "Up to 100 trades a month"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹299",
    period: "per month · ₹2,499/year",
    blurb: "For active F&O and intraday traders.",
    features: ["Unlimited imports and trades", "All reports + Compare", "Playbooks with rule tracking", "Risk rules and breach alerts", `${SCORE_NAME} and Progress`, "AI coach: 50 questions + weekly reviews a month"],
    cta: "Try Pro free for 14 days",
    highlight: true,
  },
  {
    name: "Elite",
    price: "₹699",
    period: "per month · ₹5,999/year",
    blurb: "For traders who review every session.",
    features: ["Everything in Pro", "Unlimited AI coach", "Daily AI session reviews", "AI auto-tagging of mistakes", "Broker auto-sync (when it launches)", "Priority support"],
    cta: "Go Elite",
    highlight: false,
  },
];

export default async function LandingPage() {
  const demo = await demoNumbers();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Aperture size={22} className="text-accent" /> {APP_NAME}
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#coach" className="hover:text-fg">AI coach</a>
            <a href="#pricing" className="hover:text-fg">Pricing</a>
            <a href="#faq" className="hover:text-fg">FAQ</a>
          </nav>
          <Link href="/dashboard" className="btn-primary py-1.5">Open the app</Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
              <Sparkles size={13} className="text-accent" /> Built for NSE &amp; BSE equity and F&amp;O traders
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              See what your trades are <span className="text-accent">really</span> telling you.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              {TAGLINE}. Import your tradebook, see your true P&amp;L after every Indian charge, find the habits that cost you money,
              and let an AI coach help you fix one at a time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn-primary px-5 py-2.5 text-base">
                Explore the demo journal <ArrowRight size={18} />
              </Link>
              <Link href="/trades/import" className="btn-ghost px-5 py-2.5 text-base">
                <FileUp size={18} /> Import your tradebook
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">Free to start. No broker login needed: just upload the CSV you already have.</p>
          </div>

          {/* Live numbers from the demo journal */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/10 blur-3xl" aria-hidden />
            {demo ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-warn/30 bg-surface p-5">
                  <div className="text-xs uppercase tracking-wide text-muted">Demo trader · charges</div>
                  <div className="mt-1 text-2xl font-semibold">
                    Charges ate <span className="text-warn">{demo.s.chargesPctOfGross?.toFixed(0) ?? "—"}%</span> of gross profit
                  </div>
                  <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                    <div className="bg-profit" style={{ width: `${100 - Math.min(100, demo.s.chargesPctOfGross ?? 0)}%` }} />
                    <div className="bg-warn" style={{ width: `${Math.min(100, demo.s.chargesPctOfGross ?? 0)}%` }} />
                  </div>
                  <div className="tabular mt-2 flex justify-between text-xs text-muted">
                    <span>Gross {formatINR(demo.s.grossPnl)}</span>
                    <span>Charges {formatINR(demo.s.totalCharges)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs text-muted">Followed the plan</div>
                    <div className="tabular text-xl font-semibold text-profit">{demo.followed.net > 0 ? "+" : ""}{formatINRCompact(demo.followed.net)}</div>
                    <div className="text-xs text-muted">{demo.followed.winRate.toFixed(0)}% win rate</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <div className="text-xs text-muted">Broke the plan</div>
                    <div className="tabular text-xl font-semibold text-loss">{formatINRCompact(demo.broke.net)}</div>
                    <div className="text-xs text-muted">{demo.broke.winRate.toFixed(0)}% win rate</div>
                  </div>
                </div>
                {demo.score && (
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
                    <div className="tabular text-4xl font-semibold text-accent">{demo.score.total}</div>
                    <div>
                      <div className="text-sm font-medium">{SCORE_NAME} · {demo.score.grade}</div>
                      <div className="text-xs text-muted">One number for win rate, profit factor, drawdown, consistency and discipline.</div>
                    </div>
                  </div>
                )}
                <p className="text-center text-[11px] text-muted">Live from the demo journal, a sample trader with 60 days of trades.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">Import trades to see your numbers here.</div>
            )}
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-border bg-surface/60">
          <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
            {[
              { k: "Charges", v: "Every F&O order costs brokerage, STT, exchange fees and GST. Frequent small trades quietly hand your profit to costs." },
              { k: "Habits", v: "Revenge trades after a loss, overtrading on expiry day, entries after 2 PM: patterns you can't see trade by trade." },
              { k: "No feedback loop", v: "Your broker shows P&L, not why. Without a journal, the same mistakes repeat every week." },
            ].map((x) => (
              <div key={x.k}>
                <div className="text-sm font-medium text-accent">{x.k}</div>
                <p className="mt-1 text-sm text-muted">{x.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Everything a serious Indian trader needs to review</h2>
          <p className="mt-2 max-w-2xl text-muted">From import to insight in under a minute. No spreadsheets, no formulas.</p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-surface p-5">
                <f.icon size={22} className="text-accent" />
                <h3 className="mt-3 font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { n: 1, t: "Import", d: "Upload your Zerodha tradebook or any broker CSV. Trades, charges and net P&L are ready in seconds." },
              { n: 2, t: "See the truth", d: "Your dashboard, calendar and reports show where you make money and where it leaks." },
              { n: 3, t: "Fix one habit a week", d: "Set risk rules, follow your playbooks, and let the coach review each session and week." },
            ].map((s) => (
              <div key={s.n} className="flex gap-4 rounded-xl border border-border p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">{s.n}</span>
                <div>
                  <h3 className="font-medium">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* AI coach */}
        <section id="coach" className="scroll-mt-20 border-y border-border bg-surface/60">
          <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">An AI coach for your process, not your picks</h2>
              <p className="mt-3 text-muted">
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
                  <li key={x} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-profit" /> {x}</li>
                ))}
              </ul>
              <p className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
                The coach never tells you what to buy or sell, never gives targets or predictions. That requires SEBI registration, and that&apos;s not what a journal is for.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-bg p-5 shadow-2xl">
              <div className="mb-3 flex justify-end">
                <span className="rounded-xl bg-accent/15 px-3.5 py-2 text-sm">What&apos;s my win rate on expiry days?</span>
              </div>
              <div className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
                {demo ? (
                  <p>
                    On expiry days you won <strong>{demo.expiry.winRate.toFixed(0)}%</strong> of {demo.expiry.count} trades and averaged{" "}
                    <strong>{formatINR(demo.expiry.expectancy, { signed: true })}</strong> per trade, against {demo.normal.winRate.toFixed(0)}% and{" "}
                    {formatINR(demo.normal.expectancy, { signed: true })} on other days.
                  </p>
                ) : (
                  <p>On expiry days you win less often and lose more per trade than on normal days.</p>
                )}
                <p className="mt-2">Try this: on expiry days, trade 1 lot only and stop after your first loss.</p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-profit/10 px-2 py-0.5 text-xs text-profit">
                  <ShieldCheck size={13} /> Figures verified against your data
                </span>
                <p className="mt-2 text-[11px] text-muted">Example built from the demo journal&apos;s real numbers.</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                <ShieldAlert size={14} /> Ask for a tip and it politely says no.
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Simple pricing in rupees</h2>
          <p className="mt-2 text-center text-muted">Start free. Upgrade when the journal starts paying for itself.</p>
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={p.highlight ? "relative rounded-2xl border-2 border-accent bg-surface p-6" : "rounded-2xl border border-border bg-surface p-6"}>
                {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-fg">Most popular</span>}
                <h3 className="text-lg font-medium">{p.name}</h3>
                <p className="text-sm text-muted">{p.blurb}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="tabular text-4xl font-semibold">{p.price}</span>
                  <span className="text-sm text-muted">{p.period}</span>
                </div>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-profit" /> {f}</li>
                  ))}
                </ul>
                <Link href="/dashboard" className={p.highlight ? "btn-primary mt-6 w-full" : "btn-ghost mt-6 w-full"}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted">Prices include GST. Display only in this preview: no payment is taken.</p>
        </section>

        {/* Roadmap */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="flex items-center gap-2 font-medium"><GitCompare size={18} className="text-accent" /> Coming next</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="text-fg">Broker auto-sync</span>: Kite Connect, Upstox and Dhan APIs, no CSV needed.</p>
              <p><span className="text-fg">Trade replay</span>: see the chart around every entry and exit.</p>
              <p><span className="text-fg">Mentor sharing</span>: let a coach review your journal, read-only.</p>
              <p><span className="text-fg">Mobile app</span>: journal your trade the moment you exit.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface">
            {[
              { q: "Is this investment advice?", a: `No. ${APP_NAME} is an educational journaling tool. It analyses your own past trades and habits. It never recommends securities, targets or market direction.` },
              { q: "Which brokers are supported?", a: "Zerodha tradebooks import directly. Upstox, Angel One, Groww, Dhan and most other brokers work through the CSV column mapper." },
              { q: "Do I need to give my broker password?", a: "No. You upload the tradebook CSV your broker already lets you download. Nothing connects to your trading account." },
              { q: "How accurate is net P&L?", a: "Charges are calculated per trade using current NSE/BSE rates (brokerage, STT, exchange fees, SEBI fee, stamp duty, GST). Your broker's contract note is the final word." },
            ].map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="flex items-center justify-between gap-4">{f.q}<span className="text-muted transition-transform group-open:rotate-45">+</span></span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted">
        <p className="mb-1 flex items-center justify-center gap-2 font-medium text-fg"><Aperture size={16} className="text-accent" /> {APP_NAME}</p>
        <p>{DISCLAIMER} Not affiliated with any broker or exchange. All times IST.</p>
      </footer>
    </div>
  );
}
