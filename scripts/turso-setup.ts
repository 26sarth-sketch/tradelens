// One-time setup of the hosted Turso database: creates the tables if they don't exist yet,
// then loads the demo journal if there is no user. Safe to run again.
// Run: npm run db:turso   (reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.turso,
// so your local `npm run dev` keeps using the SQLite file).
import { execFileSync } from "node:child_process";
import { createClient } from "@libsql/client/web";
import { createPrismaClient } from "@/lib/prisma-client";
import { usingBlob } from "@/lib/storage";
import { seedDemo } from "@/prisma/seed-core";

(async () => {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    console.error("TURSO_DATABASE_URL is not set. Put it and TURSO_AUTH_TOKEN in .env.turso (see README).");
    process.exit(1);
  }
  const turso = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });

  const tables = await turso.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'");
  if (tables.rows.length === 0) {
    // Prisma Migrate can't talk to Turso, so generate the schema SQL locally and apply it here.
    const sql = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], {
      encoding: "utf8",
    });
    await turso.executeMultiple(sql);
    console.log("[turso] Tables created.");
  } else {
    console.log("[turso] Tables already exist (schema changes need a manual migration; see README).");
  }
  turso.close();

  const db = createPrismaClient();
  const users = await db.user.count();
  if (users === 0) {
    console.log("[turso] Empty database: loading the demo journal…");
    const t = Date.now();
    await seedDemo(db, { clearUploads: usingBlob() });
    console.log(`[turso] Demo data loaded in ${Math.round((Date.now() - t) / 1000)}s.`);
  } else {
    console.log(`[turso] ${users} user(s) already present; demo data not reloaded (use Settings → Reset to demo data).`);
  }
  await db.$disconnect();
})().catch((e) => {
  console.error("[turso] Setup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
