# TradeLens

**The AI trading journal built for Indian traders.** Import your broker tradebook, see your true P&L after every Indian charge, find the habits that cost you money, and let an AI coach help you fix them, one at a time.

Built for NSE/BSE equity (intraday and delivery) and F&O (index and stock futures and options).

> Educational journaling tool. Not investment advice. The AI coach reviews your own trades and habits only; it never recommends what to buy or sell, gives price targets or predicts markets.

---

Documentation (PDF): [docs/TradeLens-Documentation.pdf](docs/TradeLens-Documentation.pdf) · Product tour with screenshots (PDF): [docs/TradeLens-Screenshots.pdf](docs/TradeLens-Screenshots.pdf)

## Quick start

Requires **Node.js 20+** and a free **[Neon](https://neon.tech)** PostgreSQL database.

1. Create a Neon project and copy its connection string.
2. `npm install`, then put the string in `.env` as `DATABASE_URL="postgresql://..."` (the first `npm run dev` creates `.env` from `.env.example` and stops with a reminder if the URL is still the placeholder).
3. `npm run dev`

Open **http://localhost:3000**. The first run creates the tables and loads ~60 trading days of demo data for a sample trader ("Aarav"). Tip: use a separate Neon *branch* for local work, so "Reset to demo data" never touches the live database.

### Turn on the AI Coach (optional)

Everything except the AI Coach works without a key. To enable it:

```bash
npm run set-key
```

Paste your OpenRouter API key (`sk-or-...`) at the hidden prompt, then restart `npm run dev`. Or edit `.env` directly:

```
OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_MODEL="google/gemini-3.7-flash"
```

The AI Coach uses Google Gemini models through OpenRouter only: the model must start with `google/`, and every request is pinned to Google's own infrastructure (Vertex / AI Studio) with no fallbacks. `.env` is git-ignored; nothing is hardcoded. Check the connection with `npm run ai:check` (one short call; prints the reply, model and cost).

---

## What's inside

| Area | What it does |
|---|---|
| **Import** | Zerodha Console tradebook in one click; Upstox, Angel One, Groww, Dhan and any other broker via a column mapper with presets. Fills are grouped into round-trip trades, duplicates skipped, open positions flagged, imports can be undone. |
| **Charges engine** | Brokerage, STT, exchange transaction charges, SEBI fee, stamp duty, GST (and DP charge on delivery sells) per trade. All rates, lot sizes and expiry days live in `config/market.ts`. |
| **Dashboard** | Net P&L, win rate, profit factor, avg win vs loss, expectancy, max drawdown, charges (and charges as % of gross profit). View in ₹ / % of capital / R-multiple / index points. Equity curve, P&L calendar, risk-rule widget, Lens Score radar, privacy mode. |
| **Daily Journal & Trade Log** | Day cards with notes; filterable trade log; trade review with strategy checklist, emotions, followed-plan flag, stop-loss/target (R), high/low (money left on the table), notes and chart screenshot. |
| **Reports** | Day of week, time of day (15/30-min, IST), segment, symbol, strategy, tag, emotion, expiry vs normal days, with a shared filter bar. **Compare** any two sets side by side (6 one-click presets + custom). |
| **Strategies** | Playbooks as entry/exit/risk checklists; per-strategy stats, R distribution and rule adherence; missed-trades log. |
| **Risk rules** | Max daily loss, max trades per day, max loss per trade, stop after N losses in a row, no trades after a cut-off. Live status for today + breach history. |
| **Notebook** | Pre-market plan, automatic plan-vs-actual checks, end-of-day reflection with a discipline rating. |
| **AI Coach** | Ask-your-journal chat (numbers computed in code via a tool), session review, weekly review, first-import analysis, and coach feedback on every trade (process, not outcome). Every figure the AI writes is checked against your data. Beginner/Intermediate/Expert style; English or Hinglish (Settings). |
| **Auto-tagger** | Scans trades for revenge trades, overtrading, losers held too long and entries after your cut-off, each with the reason. Accept or dismiss on *Trade Log → Auto-tag*; new imports are scanned automatically. Works without an AI key. |
| **Guide** | A side panel on every screen (button bottom-right, or press `?`) for new users: a 60-second tour, a getting-started checklist that ticks itself off, and a chat that answers "how do I…?" questions and links straight to the right page. Answers come from the app's own help text (`lib/guide/knowledge.ts`); with an AI key they are written by Gemini, without one the built-in help answers. |
| **Learn** | 8 two-to-three-minute lessons (R-multiple, profit factor, charges in F&O, position sizing, revenge trading, expiry days, the Lens Score, using the journal), linked from the dashboard tooltips. |
| **Lens Score & Progress** | A 0–100 score from six components (formula in `lib/score.ts`), rolling trend, disciplined-day streaks, discipline calendar, weekly table. |
| **Landing page** | Hero with live numbers from the demo journal, features, AI coach, INR pricing (Free / Pro ₹299 / Elite ₹699, display only), FAQ. |

### Importing trades

- **Zerodha:** Console → Reports → Tradebook → download CSV. Upload on *Add trades → Import broker CSV*.
- **Upstox, Angel One, Groww, Dhan, others:** upload any tradebook CSV, pick your broker to pre-fill the column mapping, check it, preview, import. (Preset column names are best guesses; check them against a real export.)
- Sample files: `public/samples/` (Zerodha, Upstox, Groww), also one click from the import screen.
- **Bigger test file:** `public/samples/tradelens_demo_tradebook.csv` is a Zerodha-format tradebook with 77 fills forming 37 trades over July 2026: wins, revenge re-entries, a 7-trade overtrading day, late entries, expiry-day losses, scaled entries and exits, equity, futures and a delivery hold. It also holds one open position and one commodity row, so you see both import warnings. Expected result: 37 trades, gross ₹6,801, charges ₹3,658, net ₹3,144.
- Broker API auto-sync (Kite Connect, Upstox, Dhan) is roadmap: the plug-in point is the `BrokerAdapter` interface in `lib/import/adapters/BrokerAdapter.ts`.

---

## 2-minute demo script

**Before you start:** run `npm run db:seed` (fresh data for "today"), start `npm run dev`, open the landing page at ~110% zoom. If the AI key is set, pre-generate the AI reports (see checklist) so nothing waits on the network. Exact numbers vary with the seed date; the script points at *what* to show.

| Time | Screen | Say / do |
|---|---|---|
| **0:00** | Landing page `/` | "Most Indian F&O traders lose money, and they can't see why. TradeLens is a trading journal built for India." Point at the live hero: charges eat a big share of gross profit; trades that followed the plan made money, the rest lost it. Click **Explore the demo journal**. |
| **0:15** | **Add trades** (sidebar) → Import | Click **Try the sample file** (Zerodha). "One tradebook upload: fills become complete trades, every Indian charge computed, duplicates skipped." Show the preview, click **Import**. The summary opens with **What your data says** (the AI's first read with a key; computed patterns without one). |
| **0:35** | Dashboard `/dashboard` | The **Charges ate X% of your gross profit** bar. Switch the view to **R-multiple**, then back to ₹. Point at the **risk widget**: "Today: several rules broken: too many trades, a big loss, trading after a losing streak." Point at the **red Tuesdays** in the calendar: "Expiry days." Toggle **Privacy mode** to show screen-share safety, then off. |
| **0:55** | Reports → **Compare** | Preset **Followed plan vs broke plan**: the two curves split apart. "Each trade that followed the plan made ₹X more." Tap **Before 2 PM vs after 2 PM**. |
| **1:15** | AI Coach `/coach` | Ask **"What's my win rate on expiry days?"** Expand *Numbers computed from your journal* and point at the **verified** badge: "The AI never makes up a number." Then ask **"Which stock should I buy tomorrow?"**: it politely declines (SEBI). |
| **1:35** | AI Coach → **Session review** | "It compares this morning's plan with what actually happened": rules broken, what went well, tomorrow's focus. |
| **1:45** | **Progress** `/progress` | The Lens Score climbing as the trader kept journaling; the discipline calendar turning green week by week. "Fix one habit a week." |
| **1:55** | Landing → **Pricing** | Free / Pro ₹299 / Elite ₹699. "Freemium, priced for India. Broker auto-sync is next." |

**No AI key?** Replace 1:15–1:35 with **Trade Log → Auto-tag** (revenge trades and overtrading found with exact reasons, no AI needed: accept one live), then **Notebook** (today's plan vs what happened, every check computed). The import summary's *What your data says* works without a key too.

### Demo-day checklist

- [ ] **Verify charge rates** in `config/market.ts` (STT, exchange fees, stamp duty, GST) and lot sizes / expiry days against a current broker charges page and NSE/BSE circulars. After editing: Settings → *Recalculate charges*.
- [ ] `npm run db:seed` on demo day, **after 11:00 IST** (only trades that have already closed are loaded for "today"; the 14:45 cut-off breach appears after 15:15). Re-run it after rehearsals so the sample import works fresh.
- [ ] AI key set (`npm run set-key`), then in AI Coach generate **Journal analysis**, **Session review** (today) and **Weekly review** (this week). They are cached, so the demo is instant.
- [ ] Try the two demo chat questions once.
- [ ] Privacy mode **off** (sidebar) before you start.

---

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the app (creates `.env`, syncs the DB, seeds an empty DB) |
| `npm run set-key` | Save your OpenRouter API key to `.env` from a hidden prompt |
| `npm run ai:check` | One short test call to the AI model; prints the reply, model and cost |
| `npm run db:seed` | Wipe and reload the demo data |
| `npx tsx scripts/check-seed.ts` | Print the demo patterns (plan vs no plan, expiry, after 2 PM, revenge) |
| `npm test` | Unit tests (charges, import, stats, reports, rules, score, AI verifier, …) |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Deploy to Vercel + Neon

Live demo: **https://tradelens-roan.vercel.app**

The database is **Neon** (PostgreSQL) and the app runs on **Vercel**.

1. **Neon:** create a project (Singapore is the closest region to India). Run `DATABASE_URL="<direct connection string>" npx prisma db push` once to create the tables, then `DATABASE_URL="<connection string>" npm run db:seed` to load the demo journal.
2. **Vercel:** import the GitHub repo (framework: Next.js) and add the environment variables `DATABASE_URL` (Neon, pooled string), `OPENROUTER_API_KEY` (use a separate key with a credit limit) and `OPENROUTER_MODEL=google/gemini-3.7-flash`.
3. Deploy. The build skips database setup on Vercel. AI pages allow up to 300 s per request.
4. **Screenshots (optional):** they are switched off on Vercel unless you connect a private Blob store (Vercel project → Storage → Create → Blob). That adds `BLOB_READ_WRITE_TOKEN`.

Schema changes later: edit `prisma/schema.prisma`, then run `npx prisma db push` with the direct (non-pooler) connection string of each database.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 (dark by default) · PostgreSQL (Neon) + Prisma 6 · Vercel · Recharts · Google Gemini via OpenRouter (structured outputs, tool calling, Google-only routing) · Zod.

## Project layout

```
app/(marketing)      Landing page with INR pricing
app/(app)            The journal: dashboard, journal, trades, import, reports, strategies,
                     notebook, coach, progress, settings
app/api/uploads      Serves trade screenshots from uploads/
components/          UI by area (dashboard, trades, reports, coach, score, …)
config/brand.ts      App and score names (rename here)
config/market.ts     ALL charge rates, lot sizes, expiry rules (verify before demo)
lib/charges.ts       Charges engine (pure, unit-tested)
lib/import/          Zerodha + generic CSV parsers, round-trip grouping, BrokerAdapter note
lib/stats.ts         Stats in ₹ / % / R / points
lib/reports.ts       Report groupings · lib/compare.ts · lib/filters.ts
lib/rules.ts         Risk-rule engine · lib/plan.ts (plan vs actual)
lib/score.ts         Lens Score formula · lib/progress.ts
lib/ai/              OpenRouter/Gemini client, guardrail, prompts, schemas, context, number verifier
prisma/              Schema, seed and demo-data generator
DECISIONS.md         Every judgement call made while building, with reasons
```

## How the AI stays honest

1. **Guardrail in every system prompt** (`lib/ai/guardrail.ts`): process and behaviour coaching only; no buy/sell/hold, targets, levels or predictions.
2. **Numbers come from code.** Reports get stats computed in `lib/stats.ts`; the chat calls a `query_journal` tool that runs our code. The model only explains.
3. **Every figure is checked** (`lib/ai/verify.ts`): each ₹ / % / R value in a response must match the data at the precision written, or the UI flags it.

## Roadmap (not in this build)

Broker API auto-sync (Kite Connect, Upstox, Dhan), backtesting, trade replay, live market data, payments, tax (ITR) reports, mentor sharing and communities, mobile app.
