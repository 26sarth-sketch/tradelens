# TradeLens

An AI-powered trading journal for Indian retail traders: NSE/BSE equity and F&O, true net P&L after Indian charges, and an AI coach for your trading process.

> Educational journaling tool. Not investment advice.

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first `npm run dev` creates `.env` from `.env.example` and the SQLite database (`prisma/dev.db`).

To enable the AI Coach, set these in `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-sonnet-5-5"
```

## Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the app (sets up `.env` and the DB first) |
| `npm run typecheck` | TypeScript check |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Project layout

```
app/(marketing)   Landing page
app/(app)         The journal (sidebar layout)
components/       UI, layout, charts
config/           brand.ts (names), market.ts (charges, lot sizes; verify before demo)
lib/              db, formatting (₹ en-IN, IST), stats, charges, import, AI
prisma/           schema + seed
```

## Demo script

_Added on Day 2._

See `DECISIONS.md` for choices made along the way.
