import "server-only";
import { suggestTags } from "./autotag";
import { db } from "./db";

/**
 * Scans all trades and stores new tag suggestions as pending TradeTags
 * (accepted = false). A suggestion is never repeated for a trade that already has
 * that tag in any state: accepted, pending or dismissed.
 */
export async function runAutoTagger(userId: string): Promise<number> {
  const [trades, profile, journals] = await Promise.all([
    db.trade.findMany({
      where: { userId },
      select: {
        id: true, symbol: true, entryAt: true, exitAt: true, netPnl: true, direction: true,
        qty: true, avgEntry: true, avgExit: true, plannedSL: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    db.traderProfile.findUnique({ where: { userId } }),
    db.dailyJournal.findMany({ where: { userId, planMaxTrades: { not: null } }, select: { date: true, planMaxTrades: true } }),
  ]);

  const suggestions = suggestTags(trades, {
    maxTradesPerDay: profile?.maxTradesPerDay ?? null,
    noTradeAfter: profile?.noTradeAfter ?? null,
    planMaxTrades: Object.fromEntries(journals.map((j) => [j.date, j.planMaxTrades])),
  });
  const existing = new Map(trades.map((t) => [t.id, new Set(t.tags.map((x) => x.tag.name))]));
  const fresh = suggestions.filter((s) => !existing.get(s.tradeId)?.has(s.tag));
  if (fresh.length === 0) return 0;

  const tagIds = new Map<string, string>();
  for (const name of new Set(fresh.map((s) => s.tag))) {
    const tag = await db.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, kind: "AI" },
      update: {},
    });
    tagIds.set(name, tag.id);
  }
  await db.tradeTag.createMany({
    data: fresh.map((s) => ({ tradeId: s.tradeId, tagId: tagIds.get(s.tag)!, accepted: false, aiSuggested: true, reason: s.reason })),
  });
  return fresh.length;
}

export async function pendingSuggestionCount(userId: string) {
  return db.tradeTag.count({ where: { accepted: false, dismissed: false, trade: { userId } } });
}
