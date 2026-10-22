// Demo seed: wipes the demo user's data and recreates ~60 trading days of trades.
// Run with `npm run db:seed` (local SQLite, or Turso when TURSO_DATABASE_URL is set).

import { createPrismaClient } from "@/lib/prisma-client";
import { seedDemo } from "./seed-core";

const db = createPrismaClient();
seedDemo(db)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
