// Called by scripts/setup.mjs before `npm run dev`: seeds demo data only when the DB has no users,
// so a fresh clone shows a full journal and your own data is never overwritten.
import { execSync } from "node:child_process";
import { createPrismaClient } from "@/lib/prisma-client";

const db = createPrismaClient();
db.user
  .count()
  .then((n) => {
    if (n === 0) {
      console.log("[setup] Empty database: loading demo data (npm run db:seed)");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    }
  })
  .finally(() => db.$disconnect());
