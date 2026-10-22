// Runs before `npm run dev` / `npm run build`:
// 1) creates .env from .env.example if missing, 2) pushes the schema to the Neon database,
// 3) loads demo data if the database is empty.
// Skipped on Vercel: the hosted database is set up once from a laptop (see README).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

if (process.env.VERCEL) {
  console.log("[setup] Vercel build: skipping database setup (done once from a laptop).");
  process.exit(0);
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] Created .env from .env.example");
}

process.loadEnvFile(".env"); // does not override variables already set in the shell
const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("postgres")) {
  console.error(
    "\n[setup] DATABASE_URL in .env is not a PostgreSQL connection string.\n" +
      "        Create a free database at https://neon.tech, copy its connection string and paste it\n" +
      "        into .env as DATABASE_URL=\"postgresql://...\", then run this again.\n",
  );
  process.exit(1);
}

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
execSync("npx tsx prisma/seed-if-empty.ts", { stdio: "inherit" });
