import "server-only";
import type { TraderProfile } from "@prisma/client";
import { db } from "./db";
import { evaluateAll, type RiskLimits } from "./rules";

export function limitsOf(p: TraderProfile | null | undefined): RiskLimits {
  return {
    maxDailyLoss: p?.maxDailyLoss ?? null,
    maxTradesPerDay: p?.maxTradesPerDay ?? null,
    maxLossPerTrade: p?.maxLossPerTrade ?? null,
    maxConsecutiveLosses: p?.maxConsecutiveLosses ?? null,
    noTradeAfter: p?.noTradeAfter ?? null,
  };
}

/**
 * Rebuilds the RuleBreach history from scratch. Cheap for one trader, and it keeps
 * history consistent when trades are added, deleted, imported or rules change.
 */
export async function recomputeBreaches(userId: string) {
  const [profile, trades] = await Promise.all([
    db.traderProfile.findUnique({ where: { userId } }),
    db.trade.findMany({ where: { userId }, select: { id: true, entryAt: true, exitAt: true, netPnl: true } }),
  ]);
  const breaches = evaluateAll(trades, limitsOf(profile));
  await db.$transaction([
    db.ruleBreach.deleteMany({ where: { userId } }),
    db.ruleBreach.createMany({ data: breaches.map((b) => ({ ...b, userId })) }),
  ]);
  return breaches.length;
}
