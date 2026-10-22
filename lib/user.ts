import "server-only";
import { cache } from "react";
import { db } from "./db";

// Single-user demo (DECISIONS.md #5): the first user is "you". Created on first use.
export const getCurrentUser = cache(async () => {
  const existing = await db.user.findFirst({ include: { profile: true }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return db.user.create({
    data: { name: "Trader", profile: { create: {} } },
    include: { profile: true },
  });
});
