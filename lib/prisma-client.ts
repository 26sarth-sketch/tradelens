// Prisma client factory shared by the app (lib/db.ts) and the scripts (seed, setup).
// The database is PostgreSQL on Neon; DATABASE_URL comes from .env locally and from the
// Vercel project's environment variables when deployed.

import { PrismaClient } from "@prisma/client";

export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}
