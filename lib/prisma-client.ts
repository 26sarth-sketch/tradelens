// Prisma client factory shared by the app (lib/db.ts) and the scripts (seed, setup).
// - Local dev: no TURSO_DATABASE_URL → the SQLite file from DATABASE_URL (prisma/dev.db).
// - Hosted (Vercel): TURSO_DATABASE_URL + TURSO_AUTH_TOKEN → Turso over HTTP via the libSQL
//   driver adapter. The `/web` build is pure fetch, so no native modules are bundled.

import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { PrismaClient } from "@prisma/client";

export const usingTurso = () => Boolean(process.env.TURSO_DATABASE_URL?.trim());

export function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) return new PrismaClient();
  const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
  return new PrismaClient({ adapter });
}
