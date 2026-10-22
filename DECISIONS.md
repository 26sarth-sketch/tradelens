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
| 23 | **Demo data is generated, then checked against "story" criteria.** The seed tries generator seeds until: gross ₹35k–90k, charges 35–70% of gross, plan-followed win rate ≥ 25 pts higher, expiry days and after-2-PM trades clearly worse, revenge win rate ≤ 30%. | Random data can hide the patterns; this guarantees the demo story on whatever date you run it. Same date → same data. |
| 24 | **Demo trader "Aarav": Beginner, ₹3L capital, Zerodha, risk rules 3 trades/day, ₹4k daily loss, ₹2k per trade, stop after 2 losses, no trades after 14:00.** | Beginner level shows off the coach's simple explanations; rules are tight enough that breaches appear. |
| 25 | **Revenge trades are only generated after option losses**, one lot bigger, within 2–9 minutes; ~40% are left untagged for the AI auto-tagger to find. | Mirrors real behaviour and gives the auto-tagger something to do. |
| 26 | **`npm run dev` seeds only an empty database.** `npm run db:seed` always wipes and reloads. | Fresh clones get a full demo; real data is never overwritten by accident. |
| 27 | **Today's demo trades are included only if already closed** at seed time. | Avoids "future" trades if you seed mid-session. Re-seed on demo morning for a fresh "today". |
| 28 | **Round trips: position goes 0 → non-zero → 0 per instrument, walked in time order.** Scale-ins/partial exits stay in one trade; a fill that flips the position is split (ids `<id>` and `<id>#2`). | Matches how traders think about "a trade"; FIFO average prices. |
| 29 | **Open positions at the end of a file are reported, not imported.** Import again after exiting. Their fills aren't stored, so a later tradebook containing the opening fill completes the trade. | A journal of closed trades; avoids half-trades with no exit. Limitation: a later file with only the closing fill shows as an unmatched open position. |
| 30 | **Equity intraday vs delivery is inferred**: same IST day = intraday, held overnight = delivery. | Tradebooks don't include MIS/CNC. |
| 31 | **Duplicate protection by broker trade id** (`ZERODHA:<exchange>:<trade_id>`, unique in `Execution`). Preview and save both re-run the pipeline from the raw CSV. | Re-importing an overlapping date range is safe; no server-side state between steps. |
| 32 | **Expiry: `expiry_date` column wins; otherwise parsed from the symbol** (weekly `YYMDD` codes, monthly = last expiry weekday). MCX/CDS rows are skipped with a message. | Covers both Console export variants. |
| 33 | **Import can be undone** (deletes the batch's trades). Server actions accept files up to 10 MB. | Safe to demo repeatedly. |
| 34 | **Sample tradebook lives in `public/samples/`** with a "Try the sample file" button. | One-click import in the demo. |
| 35 | **Generic importer = column mapping + broker presets** (Upstox, Angel One, Groww, Dhan, Other). Presets are header-name guesses that pre-fill the mapping; the broker is auto-detected from headers. | No per-broker parsers to maintain. ⚠️ Preset column names are unverified best guesses; check each against a real export. |
| 36 | **Instrument detection order:** exchange-style symbol → separate strike/type/expiry columns → spaced symbol ("NIFTY 25300 CE 20 OCT 26") → equity (strip "-EQ"). | Brokers format F&O names very differently. |
| 37 | **Dates are read day-first** (DD-MM-YYYY), with 12h/24h times; time can be in the date cell or its own column, else 09:15. | Indian brokers write dates day-first. |
| 38 | **Without a trade id, dedupe uses a hash of (time, instrument, side, qty, price) + occurrence number.** | Groww-style exports have no trade id; re-importing the same file still dedupes. |
| 39 | **Optional "status" column skips rejected/cancelled/open orders; "quantity is in lots" option multiplies F&O qty by lot size.** | Groww order history includes failed orders; some brokers show F&O qty in lots. |
| 40 | **`BrokerAdapter` is an interface only** (no implementation), producing the same `Fill[]` as the CSV parsers. | API auto-sync is out of scope; the note shows exactly where it plugs in. |
| 41 | **Dashboard units (₹ / % of capital / R / Points) are a URL param**; stats recompute on the server. R uses only trades with a stop-loss; Points uses only index underlyings (per-unit move, so option premium points for index options). Coverage is shown in the header. | Shareable links; honest about which trades each view includes. |
| 42 | **A trade is a win if its value in the chosen unit is > 0** (₹ = after charges). Profit factor and win/loss ratio show "∞"/blank when there are no losses. Max drawdown in ₹ is measured on capital + running P&L, so it can be shown as % of the account's peak. | Standard definitions; documented in `lib/stats.ts` and the card tooltips. |
| 43 | **P&L colours stay green/red** (Indian trading convention), but every calendar cell, tooltip and stat also shows the signed value, so colour never carries meaning alone (red/green is hard for colour-blind users). | Familiar to traders while staying accessible. |
| 44 | **Privacy mode = CSS blur on every `.money` element** plus the ₹ chart axis/tooltip, toggled from the sidebar, persisted in localStorage, restored before first paint by an inline `<head>` script. Ratios, % and win rates stay visible. | One rule covers the whole app; no flash of amounts on reload. |
| 45 | **Calendar is Mon–Fri with a weekly total column**, coloured on 4 equal steps per side scaled to the month's largest day; each cell links to `/journal/<date>`. | Trading days only; matches how traders review weeks. |
| 46 | **Dashboard range presets 30D / 60D / All** for now; the full shared filter bar comes with Reports (Day 2). | Keeps Day 1 scope tight. |
| 47 | **Screenshots are stored on local disk in `uploads/`** (git-ignored, outside `public/`) and served by `/api/uploads/<uuid>.<ext>`. Only PNG/JPG/WebP/GIF up to 5 MB, detected from the file's bytes; only generated names are ever read (no path traversal). Reseeding clears the folder. | Zero setup for the demo; swap for S3/R2 in production. |
| 48 | **Never write `path.join(process.cwd(), …)` in a module the app bundles.** Turbopack traces it, watches the project folder, and the dev server's own writes then cause an endless Fast Refresh reload loop. Use `path.resolve(...)` instead. | Found while testing the trade page (it reloaded ~8×/second). |
| 49 | **Trade review is one form with an explicit Save** (strategy + rule checklist, plan yes/no, emotions, tags, SL/target, high/low, notes, screenshot). R-multiple and MFE/MAE preview live with the same formulas as the server. Editing tags replaces the user's accepted tags but leaves pending AI tag suggestions alone. | Predictable for the user; ready for the AI auto-tagger on Day 2. |
| 50 | **MFE/MAE from manual high/low**: best open profit, worst open loss, and "left on the table" (best price vs actual exit), in gross ₹ for the whole position. | Simple, explainable version of the stretch feature; no tick data needed. |
| 51 | **Daily Journal = one card per IST day** (trades or a note), newest first, 10 per page; notes save on blur. Pre-market plan and end-of-day reflection editing live in the Notebook (Day 2). | Keeps the journal fast to scan; plan editing has its own screen. |
