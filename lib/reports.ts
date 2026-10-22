// Report groupings: split trades along one dimension and compute stats per group.
// All numbers come from lib/stats.ts so reports, dashboard and the AI coach agree.

import { MARKET_CLOSE, MARKET_OPEN } from "@/config/market";
import { istDateKey, istMinutes } from "./format";
import { computeStats, type Stats, type StatTrade } from "./stats";
import { SEGMENT_LABELS, type Segment } from "./types";

export const REPORTS = [
  { key: "day", label: "Day of week" },
  { key: "time", label: "Time of day" },
  { key: "segment", label: "Segment" },
  { key: "symbol", label: "Symbol" },
  { key: "strategy", label: "Strategy" },
  { key: "tag", label: "Tag" },
  { key: "emotion", label: "Emotion" },
  { key: "expiry", label: "Expiry day" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];

export type ReportTrade = StatTrade & {
  segment: string;
  strategyId: string | null;
  emotionBefore: string | null;
  isExpiryDay: boolean;
  tags: { tag: { name: string }; accepted: boolean }[];
};

export type ReportRow = { key: string; label: string; order: number; stats: Stats };

type Ctx = { strategies?: Record<string, string>; bucketMinutes?: 15 | 30 };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Which group(s) a trade belongs to. A trade with several tags is in several groups. */
function keysFor(report: ReportKey, t: ReportTrade, ctx: Ctx): { key: string; label: string; order: number }[] {
  switch (report) {
    case "day": {
      const wd = new Date(`${istDateKey(t.entryAt)}T00:00:00Z`).getUTCDay();
      return [{ key: String(wd), label: WEEKDAYS[wd], order: wd }];
    }
    case "time": {
      // Buckets from market open (09:15). Anything after the last bucket joins it.
      const size = ctx.bucketMinutes ?? 30;
      const open = toMin(MARKET_OPEN);
      const close = toMin(MARKET_CLOSE);
      const lastStart = open + Math.floor((close - open - 1) / size) * size;
      const start = Math.min(lastStart, open + Math.max(0, Math.floor((istMinutes(t.entryAt) - open) / size)) * size);
      return [{ key: hhmm(start), label: `${hhmm(start)}–${hhmm(Math.min(start + size, close))}`, order: start }];
    }
    case "segment":
      return [{ key: t.segment, label: SEGMENT_LABELS[t.segment as Segment] ?? t.segment, order: 0 }];
    case "symbol":
      return [{ key: t.underlying, label: t.underlying, order: 0 }];
    case "strategy":
      return t.strategyId
        ? [{ key: t.strategyId, label: ctx.strategies?.[t.strategyId] ?? "Unknown strategy", order: 0 }]
        : [{ key: "none", label: "No strategy", order: 1 }];
    case "tag": {
      const names = t.tags.filter((x) => x.accepted).map((x) => x.tag.name);
      return names.length ? names.map((n) => ({ key: n, label: n, order: 0 })) : [{ key: "none", label: "Untagged", order: 1 }];
    }
    case "emotion":
      return [t.emotionBefore ? { key: t.emotionBefore, label: t.emotionBefore, order: 0 } : { key: "none", label: "Not logged", order: 1 }];
    case "expiry":
      return [t.isExpiryDay ? { key: "yes", label: "Expiry day", order: 0 } : { key: "no", label: "Non-expiry day", order: 1 }];
  }
}

/** Natural ordering: time/day reports keep calendar order; the rest sort by net P&L. */
const CHRONOLOGICAL: ReportKey[] = ["day", "time", "expiry"];

export function groupReport(report: ReportKey, trades: ReportTrade[], ctx: Ctx & { capital?: number } = {}): ReportRow[] {
  const groups = new Map<string, { label: string; order: number; trades: ReportTrade[] }>();
  for (const t of trades) {
    for (const k of keysFor(report, t, ctx)) {
      const g = groups.get(k.key) ?? { label: k.label, order: k.order, trades: [] };
      g.trades.push(t);
      groups.set(k.key, g);
    }
  }
  const rows = [...groups.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    order: g.order,
    stats: computeStats(g.trades, { capital: ctx.capital }),
  }));
  return rows.sort((a, b) =>
    CHRONOLOGICAL.includes(report) ? a.order - b.order : a.order - b.order || b.stats.net - a.stats.net,
  );
}

/**
 * One-line takeaways computed in code: best and worst group by net P&L, ignoring
 * groups too small to mean anything.
 */
export function reportInsights(rows: ReportRow[], minTrades = 5) {
  const meaningful = rows.filter((r) => r.stats.count >= minTrades);
  if (meaningful.length < 2) return null;
  const sorted = [...meaningful].sort((a, b) => b.stats.net - a.stats.net);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}
