// Trade filters shared by Reports, Compare (two sets) and anywhere else.
// Filters live in the URL. Compare uses prefixed params ("a.plan", "b.plan").
// Date range narrows the DB query; everything else is applied in memory, which is
// simple, testable, and fast for a single trader's few thousand trades.

import { istDateKey, istMinutes } from "./format";
import { EMOTIONS, SEGMENTS, type Segment } from "./types";

export type TradeFilter = {
  from?: string; // IST day key, inclusive
  to?: string;
  segment?: Segment;
  strategyId?: string; // "none" = trades without a strategy
  tag?: string; // tag name; "none" = untagged
  plan?: "followed" | "broke";
  expiry?: "yes" | "no";
  /** Entry time window, IST "HH:MM" (from inclusive, to exclusive). */
  timeFrom?: string;
  timeTo?: string;
  emotions?: string[]; // emotion before entry, any of
  stopLoss?: "yes" | "no";
  direction?: "LONG" | "SHORT";
};

export const FILTER_KEYS = [
  "from", "to", "segment", "strategyId", "tag", "plan", "expiry", "timeFrom", "timeTo", "emotions", "stopLoss", "direction",
] as const satisfies readonly (keyof TradeFilter)[];

/** Fields any filterable trade must have (Prisma rows with `tags` included satisfy this). */
export type FilterableTrade = {
  entryAt: Date;
  exitAt: Date;
  segment: string;
  strategyId: string | null;
  followedPlan: boolean | null;
  isExpiryDay: boolean;
  emotionBefore: string | null;
  plannedSL: number | null;
  direction: string;
  tags: { tag: { name: string }; accepted: boolean }[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

type Params = Record<string, string | string[] | undefined>;

/** Reads a filter from URL params; unknown or malformed values are ignored. */
export function parseFilter(params: Params, prefix = ""): TradeFilter {
  const get = (k: string) => {
    const v = params[prefix + k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const f: TradeFilter = {};
  const from = get("from");
  const to = get("to");
  if (from && DAY.test(from)) f.from = from;
  if (to && DAY.test(to)) f.to = to;
  const seg = get("segment");
  if (seg && (SEGMENTS as readonly string[]).includes(seg)) f.segment = seg as Segment;
  if (get("strategyId")) f.strategyId = get("strategyId");
  if (get("tag")) f.tag = get("tag");
  const plan = get("plan");
  if (plan === "followed" || plan === "broke") f.plan = plan;
  const expiry = get("expiry");
  if (expiry === "yes" || expiry === "no") f.expiry = expiry;
  const tf = get("timeFrom");
  const tt = get("timeTo");
  if (tf && HHMM.test(tf)) f.timeFrom = tf;
  if (tt && HHMM.test(tt)) f.timeTo = tt;
  const emo = get("emotions")?.split(",").filter((e) => (EMOTIONS as readonly string[]).includes(e));
  if (emo?.length) f.emotions = emo;
  const sl = get("stopLoss");
  if (sl === "yes" || sl === "no") f.stopLoss = sl;
  const dir = get("direction");
  if (dir === "LONG" || dir === "SHORT") f.direction = dir;
  return f;
}

/** Writes a filter back to URL params (with an optional prefix). */
export function filterToParams(f: TradeFilter, prefix = "", into = new URLSearchParams()): URLSearchParams {
  for (const k of FILTER_KEYS) {
    const v = f[k];
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    into.set(prefix + k, Array.isArray(v) ? v.join(",") : v);
  }
  return into;
}

export function isEmptyFilter(f: TradeFilter) {
  return FILTER_KEYS.every((k) => f[k] == null);
}

export function matches(t: FilterableTrade, f: TradeFilter): boolean {
  const day = istDateKey(t.entryAt);
  if (f.from && day < f.from) return false;
  if (f.to && day > f.to) return false;
  if (f.segment && t.segment !== f.segment) return false;
  if (f.strategyId === "none" ? t.strategyId != null : f.strategyId && t.strategyId !== f.strategyId) return false;
  if (f.tag) {
    const names = t.tags.filter((x) => x.accepted).map((x) => x.tag.name);
    if (f.tag === "none" ? names.length > 0 : !names.includes(f.tag)) return false;
  }
  if (f.plan === "followed" && t.followedPlan !== true) return false;
  if (f.plan === "broke" && t.followedPlan !== false) return false;
  if (f.expiry === "yes" && !t.isExpiryDay) return false;
  if (f.expiry === "no" && t.isExpiryDay) return false;
  const m = istMinutes(t.entryAt);
  if (f.timeFrom && m < toMin(f.timeFrom)) return false;
  if (f.timeTo && m >= toMin(f.timeTo)) return false;
  if (f.emotions && !f.emotions.includes(t.emotionBefore ?? "")) return false;
  if (f.stopLoss === "yes" && t.plannedSL == null) return false;
  if (f.stopLoss === "no" && t.plannedSL != null) return false;
  if (f.direction && t.direction !== f.direction) return false;
  return true;
}

export function applyFilter<T extends FilterableTrade>(trades: T[], f: TradeFilter): T[] {
  return trades.filter((t) => matches(t, f));
}

/** Short human description, e.g. "Options · followed plan · after 14:00". */
export function describeFilter(f: TradeFilter, names: { strategies?: Record<string, string> } = {}): string {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`${f.from ?? "start"} → ${f.to ?? "today"}`);
  if (f.segment) parts.push(f.segment.replace("EQ_", "Equity ").replace("OPT", "Options").replace("FUT", "Futures").toLowerCase());
  if (f.strategyId) parts.push(f.strategyId === "none" ? "no strategy" : (names.strategies?.[f.strategyId] ?? "strategy"));
  if (f.tag) parts.push(f.tag === "none" ? "untagged" : `#${f.tag}`);
  if (f.plan) parts.push(f.plan === "followed" ? "followed plan" : "broke plan");
  if (f.expiry) parts.push(f.expiry === "yes" ? "expiry days" : "non-expiry days");
  if (f.timeFrom && f.timeTo) parts.push(`${f.timeFrom}–${f.timeTo}`);
  else if (f.timeFrom) parts.push(`after ${f.timeFrom}`);
  else if (f.timeTo) parts.push(`before ${f.timeTo}`);
  if (f.emotions) parts.push(f.emotions.join("/"));
  if (f.stopLoss) parts.push(f.stopLoss === "yes" ? "with stop-loss" : "no stop-loss");
  if (f.direction) parts.push(f.direction === "LONG" ? "longs" : "shorts");
  return parts.length ? parts.join(" · ") : "All trades";
}
