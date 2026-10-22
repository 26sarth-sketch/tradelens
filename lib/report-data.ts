import "server-only";
import { db } from "./db";
import { fromIST } from "./format";
import type { TradeFilter } from "./filters";

/** Trades for reports: the date range narrows the query; other filters run in memory. */
export async function loadReportTrades(userId: string, f: Pick<TradeFilter, "from" | "to"> = {}) {
  return db.trade.findMany({
    where: {
      userId,
      ...(f.from || f.to
        ? { entryAt: { ...(f.from ? { gte: fromIST(f.from, "00:00") } : {}), ...(f.to ? { lte: fromIST(f.to, "23:59:59") } : {}) } }
        : {}),
    },
    select: {
      id: true, entryAt: true, exitAt: true, netPnl: true, grossPnl: true, totalCharges: true,
      rMultiple: true, points: true, underlying: true, segment: true, strategyId: true,
      emotionBefore: true, isExpiryDay: true, followedPlan: true, plannedSL: true, direction: true,
      tags: { select: { accepted: true, tag: { select: { name: true } } } },
    },
    orderBy: { exitAt: "asc" },
  });
}

/** Strategy and tag names for filter dropdowns and labels. */
export async function loadFilterOptions(userId: string) {
  const [strategies, tags] = await Promise.all([
    db.strategy.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    db.tag.findMany({ where: { userId }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    strategies,
    strategyNames: Object.fromEntries(strategies.map((s) => [s.id, s.name])),
    tags: tags.map((t) => t.name),
  };
}
