// Runs before `npm run dev` / `npm run build` so `npm install && npm run dev` just works:
// 1) creates .env from .env.example if missing, 2) syncs the SQLite schema,
// 3) loads demo data if the database is empty.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] Created .env from .env.example");
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx tsx prisma/seed-if-empty.ts", { stdio: "inherit" });
