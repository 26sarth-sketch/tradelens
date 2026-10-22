# Decisions

Choices made where the brief was ambiguous, newest at the bottom. Each one is easy to revisit.

| # | Decision | Why |
|---|---|---|
| 1 | **SCOPE.md was not available.** The plan follows the build prompt only. | File wasn't in the project folder or Desktop/Documents/Downloads. Re-check the plan when it's shared. |
| 2 | **Score is named "Lens Score"**, set in `config/brand.ts` with the app name. | The name was blank in the prompt; one constant makes renaming trivial. |
| 3 | **Prisma 6.19 (stable), not 7/8.** | npm's `latest` tag points at an 8.0 release candidate; 6.x is stable and needs no driver adapters or extra config for SQLite. |
| 4 | **Next.js 16.4 + React 19.3 + Tailwind v4** (current `create-next-app`). | Latest stable at build time. Route params are async (`await params`). |
| 5 | **Single demo user, no auth.** | A hackathon demo doesn't need login; the schema still has a `User` table so auth can be added later. |
| 6 | **"Enum" fields are `String`s** validated by TypeScript unions; lists are JSON strings. | Keeps the Prisma/SQLite setup simple and portable. |
| 7 | **Dark theme only for now**, with colour tokens in `app/globals.css`. | Prompt says dark by default; tokens allow a light theme later. |
| 8 | **`npm run dev` auto-creates `.env` and syncs the DB** (`scripts/setup.mjs` via `predev`). | Meets "runs with `npm install && npm run dev`" with zero manual steps. |
| 9 | **Install-script allowlist** (`allowScripts` in `package.json`) approves Prisma, esbuild and unrs-resolver. | npm 11 blocks postinstall scripts by default; Prisma needs them to download its engine. |
| 10 | **Money stored as Float rupees**, rounded to 2 decimals. | Precise enough for a journal; avoids paise conversions everywhere. |
| 11 | **"Progress" page = Lens Score over time + plan-adherence streak + rule-breach calendar.** | The prompt lists the page without defining it. |
| 12 | **Cache Components off; the `(app)` layout is `force-dynamic`.** | Next 16.4 enables Cache Components by default, which requires Suspense around every DB read. A single-user journal is all live data, so per-request rendering is simpler and avoids reading the DB at build time. |
| 13 | **Charges rates as of Oct 2026**, including the STT rise from 1 Apr 2026 (futures 0.05%, options 0.15% of sell premium) and NSE lot sizes NIFTY 65 / BANKNIFTY 30. | Best-known current values; all in `config/market.ts`, flagged "verify before demo". |
| 14 | **Not modelled in charges:** STT on exercised ITM options, NSE IPFT (~₹10/cr), and exchange holidays shifting expiry days. | Small or rare; keeps the engine simple. Documented in code comments. |
| 15 | **Each charge is rounded to paise separately**, and GST is applied to the rounded components. | Deterministic, matches how brokers show contract notes, and keeps tests hand-checkable. |
| 16 | **Brokerage is per executed order**: a trade stores buy/sell order counts; percentage brokerage splits a side's value evenly across its orders. | Imports give us fill counts; exact per-order values aren't needed for a journal. |
| 17 | **Default brokerage plan is "DISCOUNT"** (₹20/order or 0.03%, free delivery); "FLAT20" is the alternative, chosen in the profile. | Covers Zerodha/Upstox/Angel One and Dhan/Groww-style plans. |
| 18 | **Tests use Node's built-in test runner via `tsx`** (`npm test`). | No extra framework to install. |
| 19 | **Manual entry logs a completed round trip** (entry + exit in one form). Delivery trades get a separate exit date; others exit the same day. | Fast to fill on mobile; open positions aren't tracked in a journal of closed trades. |
| 20 | **R-multiple = net P&L ÷ (|entry − stop-loss| × qty)**; planned R:R = |target − entry| ÷ |entry − stop-loss|. Both empty without a stop-loss. | Standard definitions; using net P&L keeps charges honest. |
| 21 | **Every ₹ amount renders through `<Money>`** (class `money`). | Privacy mode can blur all amounts with one CSS rule. |
| 22 | **Trade Log filters are a plain GET form** (URL params). | Shareable, back-button friendly, works without JS. The global filter bar for Reports comes on Day 2. |
