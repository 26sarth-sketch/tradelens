// Runs before `npm run dev` / `npm run build` so `npm install && npm run dev` just works:
// 1) creates .env from .env.example if missing, 2) syncs the SQLite schema,
// 3) loads demo data if the database is empty.
// Skipped on Vercel and whenever TURSO_DATABASE_URL is set: the hosted database is set up
// once with `npm run db:turso` instead (Prisma CLI can't push to Turso directly).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

if (process.env.VERCEL) {
  console.log("[setup] Vercel build: skipping local SQLite setup (the deployed app uses Turso).");
  process.exit(0);
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] Created .env from .env.example");
}

process.loadEnvFile(".env"); // does not override variables already set in the shell
if (process.env.TURSO_DATABASE_URL) {
  console.log("[setup] TURSO_DATABASE_URL is set: using Turso, skipping local SQLite setup.");
  process.exit(0);
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx tsx prisma/seed-if-empty.ts", { stdio: "inherit" });
