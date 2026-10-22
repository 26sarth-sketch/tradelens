import "server-only";
import { db } from "@/lib/db";
import type { GuideProgress } from "./guide";

/** Which setup steps the trader has already done (drives the Guide's checklist). Counts only, nothing sensitive. */
export async function getGuideProgress(userId: string): Promise<GuideProgress> {
  const [trades, reviewed, profile, strategies, plans, chats, reports] = await Promise.all([
    db.trade.count({ where: { userId } }),
    db.trade.count({ where: { userId, OR: [{ strategyId: { not: null } }, { emotionBefore: { not: null } }, { followedPlan: { not: null } }] } }),
    db.traderProfile.findUnique({ where: { userId } }),
    db.strategy.count({ where: { userId } }),
    db.dailyJournal.count({ where: { userId, planMaxTrades: { not: null } } }),
    db.chatMessage.count({ where: { userId } }),
    db.aiReport.count({ where: { userId } }),
  ]);
  return {
    hasTrades: trades > 0,
    reviewedTrade: reviewed > 0,
    hasRiskRules: Boolean(
      profile && (profile.maxDailyLoss != null || profile.maxTradesPerDay != null || profile.maxLossPerTrade != null || profile.maxConsecutiveLosses != null || profile.noTradeAfter != null),
    ),
    hasStrategy: strategies > 0,
    hasPlan: plans > 0,
    usedCoach: chats + reports > 0,
  };
}
