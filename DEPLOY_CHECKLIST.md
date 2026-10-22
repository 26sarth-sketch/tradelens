# TradeLens: final release checklist (GitHub + Vercel)

Work top to bottom. Tick each box only when the **Expected** result is seen. If anything fails, stop, fix, and re-run that section.
Sections 3–6 are run twice: once locally (`npm run dev`) and once on the Vercel URL (section 9).

---

## 0. Decisions to make first (blockers for Vercel)

| # | Decision | Why it matters | Recommended |
|---|----------|----------------|-------------|
| D1 ✅ Neon (Postgres), replaced Turso | **Where the database lives** | Vercel's filesystem is read-only and resets, so `prisma/dev.db` can't be written there. | **Turso** (hosted SQLite, free tier). Same schema; Prisma connects via the libSQL adapter. Alternative: Neon Postgres (schema provider change). Quickest but weakest: ship the seeded `dev.db` read-only, so nothing a judge enters is saved. |
| D2 ✅ Screenshots off on Vercel (Blob optional) | **Where screenshot uploads go** | `uploads/` is local disk; on Vercel files vanish. | **Vercel Blob** (free tier), or hide the screenshot upload on the hosted demo. |
| D3 | **GitHub repo visibility** | Public repos are visible to everyone; secrets must never be in history. | Public for the hackathon (history already scanned clean, see 1.3). |
| D4 | **AI key on the hosted demo** | Anyone with the URL can spend the key's credits. | Use a **separate OpenRouter key with a low credit limit** (e.g. $3) for Vercel. Top up the account first (≈ $2 left). |
| D5 | **Demo data on the hosted DB** | Judges should land on a full story. | Seed the hosted DB once with `npm run db:seed`. "Reset to demo data" in Settings re-seeds. |

---

## 1. Secrets and repo hygiene

| ✓ | Check | Command / action | Expected |
|---|-------|------------------|----------|
| ✅ | 1.1 `.env` is ignored | `git check-ignore .env` | prints `.env` |
| ✅ | 1.2 No env, DB or uploads tracked | `git ls-files \| grep -E "^\.env$\|\.db$\|^uploads/[^.]"` | no output |
| ✅ | 1.3 No key anywhere in git history | `git grep -nE "sk-or-v1-[A-Za-z0-9]{10}\|sk-ant-" $(git rev-list --all)` | no output |
| ✅ | 1.4 `.env.example` has placeholders only | open it | `OPENROUTER_API_KEY=""` |
| ✅ | 1.5 Working tree clean | `git status --short` | no output (or only intended changes) |
| ✅ | 1.6 No Anthropic leftovers | `grep -rni anthropic app lib components scripts package.json` | no output |

## 2. Local quality gate

| ✓ | Check | Command | Expected |
|---|-------|---------|----------|
| ✅ | 2.1 Clean install | `rm -rf node_modules .next && npm install` | completes, `prisma generate` runs |
| ✅ | 2.2 Typecheck | `npm run typecheck` | no errors |
| ✅ | 2.3 Lint | `npm run lint` | no errors |
| ✅ | 2.4 Unit tests | `npm test` | `pass 113`, `fail 0` |
| ✅ | 2.5 Production build | `npm run build` | "Compiled successfully" |
| ✅ | 2.6 Production server | `npm run start`, open http://localhost:3000 | landing page loads |
| ✅ | 2.7 AI smoke test | `npm run ai:check` | a reply, `Served by: google/gemini-3.7-flash`, a cost line |

### Results: sections 1–2 (22 Oct 2026, local, commit before push)

- **1.** `.env` ignored; no env/DB/uploads tracked; no key in any commit (`git log --all -p` scan: 0 matches); `.env.example` placeholder only; no Anthropic references left.
- **2.1** Clean install OK, Prisma client generated. `npm audit`: 8 high, all in dev tooling (`eslint-config-next`, `prisma` CLI → braces/micromatch/fast-glob/deepmerge-ts), not in app runtime; the offered fixes are breaking version changes, so they are left as is.
- **2.2–2.4** Typecheck clean · lint clean · tests 113 pass / 0 fail.
- **2.5–2.6** Build OK; `npm run start`: all 22 main pages 200, unknown trade and unknown page 404, no server errors.
- **2.7** `ai:check`: reply received, served by `google/gemini-3.7-flash`, $0.0028 (billed by Google via BYOK).

## 3. Inputs (what the trader enters)

| ✓ | Check | Steps | Expected |
|---|-------|-------|----------|
| ✅ | 3.1 Manual trade, valid | Import → Add a trade manually: NIFTY option, buy/sell price, qty, times | Trade appears in Trade Log with charges and net P&L in ₹ |
| ✅ | 3.2 Manual trade, invalid | Leave price empty / qty 0 / exit before entry | Clear inline error, nothing saved, no crash |
| ✅ | 3.3 Zerodha CSV | Upload a Zerodha tradebook CSV | Summary: trades grouped into round trips; "What your data says" shows |
| ✅ | 3.4 Duplicate import | Upload the same CSV again | Duplicates skipped and counted, no double trades |
| ✅ | 3.5 Generic CSV + mapping | Upload an Upstox/Groww-style CSV, map columns, pick a preset | Trades imported with correct side, qty, prices |
| ✅ | 3.6 Bad file | Upload a non-CSV / empty CSV / CSV with wrong columns | Friendly error, nothing imported |
| ✅ | 3.7 Undo import | Undo the last import | Its trades disappear; stats update |
| ✅ | 3.8 Trade review fields | Set strategy, emotions, tags, SL/target, high/low, notes → Save | Saved; R and MFE/MAE shown |
| ✅ | 3.9 Screenshot upload | Upload PNG < 5 MB; then a 6 MB file; then a PDF | First works; others rejected with a message (on Vercel: per D2) |
| ✅ | 3.10 Notebook | Fill pre-market plan and end-of-day reflection | Saved; session review uses the plan |
| ✅ | 3.11 Settings | Change risk rules / brokerage plan / experience level / Hinglish | Saved; charges and breaches recalculate |
| ✅ | 3.12 Strategies & missed trades | Create a playbook with rules; log a missed trade | Shown with per-strategy stats |
| ✅ | 3.13 Filters | Apply date range, symbol, strategy, tag filters | Every report respects them; clearing restores totals |

## 4. Outputs (what the trader sees)

| ✓ | Check | Expected |
|---|-------|----------|
| ✅ | 4.1 Dashboard stat cards | Net P&L, win rate, profit factor, charges match Reports for the same range |
| ✅ | 4.2 ₹ / % / R / points toggle | All cards switch units; nothing shows `NaN` or `undefined` |
| ✅ | 4.3 Indian formatting | ₹1,02,656 style grouping, IST times, `22 Oct 2026` dates |
| ✅ | 4.4 Equity curve, calendar heatmap | Render with data; hover tooltips work |
| ✅ | 4.5 Lens Score radar + Progress | Score shown with six components; Progress shows the rise |
| ✅ | 4.6 Risk widget (today) | Shows OK / Close / Broken with icon + word |
| ✅ | 4.7 Reports tabs + Compare | All tabs load; Compare shows two groups side by side |
| ✅ | 4.8 Charges | A sample trade's charges match `config/market.ts` (the Learn lesson example matches too) |
| ✅ | 4.9 Privacy mode | Hides all ₹ amounts everywhere, including the AI pages |
| ✅ | 4.10 Learn | All 8 lessons open; dashboard "Learn more" links resolve |
| ✅ | 4.11 Landing page | Hero numbers, features, INR pricing (Free / Pro / Elite) |
| ✅ | 4.12 Footer disclaimer | "Educational journaling tool. Not investment advice." on every page |
| ✅ | 4.13 Mobile (375 px) | No sideways scroll on any page; menu opens |

## 5. Errors and edge cases

| ✓ | Check | Steps | Expected |
|---|-------|-------|----------|
| ✅ | 5.1 Unknown trade | Open `/trades/does-not-exist` | Not-found page, not a crash |
| ✅ | 5.2 Unknown page | Open `/nope` | 404 page |
| ✅ | 5.3 Empty journal | Delete all trades (or fresh DB without seed) | Dashboard, reports, coach show empty states, no `NaN` |
| ✅ | 5.4 Odd dates | `/coach?tab=session&date=abc`, a future date, a weekend | Falls back or shows "no trades", no crash |
| ✅ | 5.5 Bad filter values | Hand-edit filter query params | Ignored safely |
| ✅ | 5.6 AI out of credits (402) | (Simulate with an exhausted key) | "Out of credits" message, no retry loop |
| ✅ | 5.7 AI wrong key (401) | Set a fake `sk-or-...` key | "OpenRouter rejected the API key" message |
| ✅ | 5.8 AI slow / offline | Disconnect network, click Review | Retries, then "Couldn't reach the AI service", page still usable |
| ✅ | 5.9 Server log | Watch terminal / Vercel logs during sections 3–5 | No unhandled errors; `[ai]` lines never contain the key |

## 6. No API key mode

Run with `OPENROUTER_API_KEY=""` (and on Vercel, before adding the key).

| ✓ | Check | Expected |
|---|-------|----------|
| ✅ | 6.1 App starts and every non-AI page works | Yes |
| ✅ | 6.2 AI Coach page | "Connect the AI Coach" banner; no stack trace |
| ✅ | 6.3 Journal analysis tab | Code-computed "What your data says" (QuickRead) instead of AI |
| ✅ | 6.4 Chat / session / weekly / trade feedback | Buttons disabled or show the "add a key" message; nothing crashes |
| ✅ | 6.5 Import summary | QuickRead shown, no AI error |
| ✅ | 6.6 Auto-tagger | Still works (rule-based, no AI) |
| ✅ | 6.7 Non-Google model | `OPENROUTER_MODEL="openai/gpt-x"` → "must be a Google model" message, no request sent |

## 7. AI with key (Gemini via OpenRouter)

Note model and cost from the card footer / server log for each.

| ✓ | Check | Expected |
|---|-------|----------|
| ✅ | 7.1 Ask your journal | Answer with "Numbers computed from your journal" and "All N figures verified" |
| ✅ | 7.2 Session review | Rules broken / went well / to fix / tomorrow's focus; verified |
| ✅ | 7.3 Weekly review | 3 strengths, 3 mistakes, 3 rules; verified |
| ✅ | 7.4 Journal analysis | What's working / where money leaks / 3 steps; verified |
| ✅ | 7.5 Trade feedback | Process rating + lesson; verified |
| ✅ | 7.6 Guardrail | Ask "Should I buy BANKNIFTY tomorrow?" / "Give me a target for Reliance" → politely declines, mentions SEBI, offers process help |
| ✅ | 7.7 Hinglish + experience level | Switch in Settings → tone and language change |
| ✅ | 7.8 Cached reports | Reload page → report appears instantly, no new `[ai]` log line |
| ✅ | 7.9 Footer shows `Model: google/gemini-3.7-flash` | Yes |

### Results: sections 3–7 (22 Oct 2026, local `npm run dev`, Gemini via OpenRouter)

**Inputs (3):** manual trade saved with correct charges (₹3,900 gross → ₹3,808.52 net); empty fields, exit before entry and 0 lots are blocked with messages; Zerodha sample → 9 trades, 1 open position held back, commodity row skipped with a reason; re-upload → 0 new, 20 fills recognised; Upstox sample through column mapping → 5 trades incl. a short; empty file, image and wrong-column CSV rejected; undo removed the trades and re-checked breaches; review fields, tags, R (1.46R) and screenshot saved; 6 MB and fake-image screenshots rejected; Notebook plan + reflection saved; brokerage plan change recalculated charges on all trades, risk-rule change re-checked history; strategy + missed trade logged; every filter's count matches the database.
**Outputs (4):** dashboard = Reports (203 trades, net ₹18,079); no NaN/undefined on 33 pages incl. ₹/%/R/points views; en-IN grouping and IST; charts, calendar, Lens Score radar (66) and Progress (▲34); charges match `config/market.ts`; all Learn links resolve; landing pricing ₹0/₹299/₹699; disclaimer on every page; no sideways scroll at 375 px on 25 pages.
**Errors (5):** unknown trade/page/strategy/lesson/import and path-traversal on uploads → 404; empty journal shows "No trades yet" everywhere; impossible dates ignored or 404; wrong key → "OpenRouter rejected the API key"; offline → 4 attempts in 7 s then "Couldn't reach the AI service"; 402 handled earlier today ("out of credits", no retry); key never appears in logs.
**No key (6):** banner, disabled chat, "AI Coach is off" on reviews and trade feedback, code-computed "What your data says" on Coach and import summary, auto-tagger found 2 suggestions, non-Google model refused.
**AI (7), model `google/gemini-3.7-flash`:** chat in Hinglish (7/7 verified, $0.0133); tip and target request declined with SEBI mention ($0.0049); session review in Hinglish ($0.0125); trade feedback (3/3 verified, $0.0034); first-import analysis (35/35 verified, $0.0232); cached report reload made no AI call. Weekly review (31/31, $0.0242) and journal analysis (30/30, $0.0309) were checked live earlier the same day.

**Fixed during this pass:** privacy mode now blurs ₹ amounts inside AI text, auto-tag reasons, plan checks and missed-trade notes; impossible dates (e.g. `2026-13-45`) no longer crash Reports (one strict `isDayKey` check everywhere, with tests); clearer messages for empty and non-CSV imports; the screenshot error no longer shows twice; the verifier accepts "₹X over the limit" (a breach value minus its own limit); coach text renders *italics*.
**Reset to demo data** now runs in-process (3 s) and was used to restore the demo journal after testing.

## 8. Push to GitHub

| ✓ | Step | Command | Expected |
|---|------|---------|----------|
| ✅ | 8.1 Sections 1–2 all ticked | | |
| ✅ | 8.2 Create repo and push | `gh repo create tradelens --public --source . --push` | Repo URL printed |
| ✅ | 8.3 Check on github.com | Open repo | README renders; no `.env`, `dev.db`, `uploads/*` files |
| ✅ | 8.4 Fresh clone works | `git clone <url> /tmp/tl && cd /tmp/tl && npm install && npm run dev` | App runs with demo data, no key needed |

### Results: section 8 (22 Oct 2026)

- Secrets re-scanned before pushing: no `.env`, `.env.turso`, database or uploads tracked; no OpenRouter key, JWT-style token or Blob token anywhere in history. Commit author is a local machine address, no personal email.
- Public repo: https://github.com/26sarth-sketch/tradelens (default branch `main`, 221 files, HEAD `c568cf1` matches local).
- Fresh clone + `npm install && npm run dev`: `.env` created from the example, SQLite set up, demo journal seeded (193 trades), all main pages 200, Coach shows the "add a key" banner.

### Switch to Neon (22 Oct 2026)

Database moved from SQLite/Turso to PostgreSQL on Neon (project `tradelens`, Singapore, branches `main` for the live demo and `dev` for local). Re-verified on Neon: tests 117 pass; all main pages 200; symbol search and filters; Zerodha import + duplicate detection (0 new, 20 fills recognised); first-import AI analysis saved to Neon; Reset to demo data in 11 s. Seed on Neon `main`: 193 trades, net ₹13,343.23 (same as before).

## 9. Deploy to Vercel

| ✓ | Step | Expected |
|---|------|----------|
| ☐ | 9.1 Database ready (D1) and seeded | Hosted DB has demo data |
| ☐ | 9.2 Import the GitHub repo in Vercel (Framework: Next.js) | Project created |
| ☐ | 9.3 Environment variables (Production + Preview) | `DATABASE_URL` (+ DB auth token), `OPENROUTER_API_KEY` (limited key, D4), `OPENROUTER_MODEL=google/gemini-3.7-flash`, blob token if D2 |
| ☐ | 9.4 Build settings | Build doesn't run the local SQLite `prisma db push` / seed (setup script must skip on Vercel) |
| ☐ | 9.5 First deploy | Build log green; no "read-only file system" errors |
| ☐ | 9.6 Re-run sections 3–7 on the Vercel URL | All ticked (6 can be checked on a Preview deploy without the key) |
| ☐ | 9.7 Function timeouts | AI calls (up to ~35 s) finish; raise `maxDuration` on AI routes if they time out |
| ☐ | 9.8 Logs | Vercel → Logs: no errors, no key in logs |

## 10. Demo day

| ✓ | Check |
|---|-------|
| ☐ | 10.1 OpenRouter credits topped up; spend limit set |
| ☐ | 10.2 Pre-generate weekly review + journal analysis on the live site (cached = instant during the pitch) |
| ☐ | 10.3 "Reset to demo data" tested on the live site |
| ☐ | 10.4 Local `npm run dev` ready as a fallback if Wi-Fi or Vercel fails |
| ☐ | 10.5 README 2-minute demo script walked once on the live URL |
