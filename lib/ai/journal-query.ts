// "Ask your journal" fact engine. The model never computes numbers: it calls the
// query_journal tool with a filter (and optional grouping), and this code returns
// stats computed by lib/stats.ts. Pure, so it's unit-tested.

import { applyFilter, describeFilter, type FilterableTrade, type TradeFilter } from "../filters";
import { groupReport, REPORTS, type ReportKey, type ReportTrade } from "../reports";
import { computeStats } from "../stats";
import { EMOTIONS, SEGMENTS } from "../types";
import { packStats } from "./pack";

/** Strict-mode friendly "this or null" (anyOf is supported; type arrays may not be). */
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

/** JSON Schema for the tool (strict: every field required, null = not used). */
export const QUERY_TOOL = {
  name: "query_journal",
  description:
    "Compute statistics from the trader's own journal. Returns trade count, win rate, net/gross P&L, charges, profit factor, average win/loss, expectancy and max drawdown for the trades matching the filter, optionally split into groups. Call it once per set of trades you need numbers for. All fields are required; use null for any filter you don't need.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["from", "to", "segment", "strategy", "symbol", "tag", "plan", "expiry", "time_from", "time_to", "emotions", "stop_loss", "direction", "group_by"],
    properties: {
      from: nullable({ type: "string", description: "Start date YYYY-MM-DD (IST), inclusive" }),
      to: nullable({ type: "string", description: "End date YYYY-MM-DD (IST), inclusive" }),
      segment: nullable({ type: "string", enum: [...SEGMENTS], description: "EQ_INTRADAY, EQ_DELIVERY, FUT or OPT" }),
      strategy: nullable({ type: "string", description: "Strategy name exactly as in the journal, or 'none' for trades without a strategy" }),
      symbol: nullable({ type: "string", description: "Underlying, e.g. NIFTY, BANKNIFTY, RELIANCE" }),
      tag: nullable({ type: "string", description: "Tag name, or 'none' for untagged" }),
      plan: nullable({ type: "string", enum: ["followed", "broke"] }),
      expiry: nullable({ type: "string", enum: ["yes", "no"], description: "yes = trades on the contract's expiry day" }),
      time_from: nullable({ type: "string", description: "Entry at or after HH:MM IST" }),
      time_to: nullable({ type: "string", description: "Entry before HH:MM IST" }),
      emotions: nullable({ type: "array", items: { type: "string", enum: [...EMOTIONS] }, description: "Emotion before entry, any of" }),
      stop_loss: nullable({ type: "string", enum: ["yes", "no"], description: "Whether the trade had a stop-loss set" }),
      direction: nullable({ type: "string", enum: ["LONG", "SHORT"] }),
      group_by: nullable({
        type: "string",
        enum: REPORTS.map((r) => r.key),
        description: "Split results by: day (of week), time (30-min buckets), segment, symbol, strategy, tag, emotion, expiry",
      }),
    },
  },
};

export type QueryInput = {
  from: string | null;
  to: string | null;
  segment: string | null;
  strategy: string | null;
  symbol: string | null;
  tag: string | null;
  plan: "followed" | "broke" | null;
  expiry: "yes" | "no" | null;
  time_from: string | null;
  time_to: string | null;
  emotions: string[] | null;
  stop_loss: "yes" | "no" | null;
  direction: "LONG" | "SHORT" | null;
  group_by: ReportKey | null;
};

export type QueryTrade = ReportTrade & FilterableTrade;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

/** Turns tool input into our filter, ignoring malformed values. */
export function toFilter(q: Partial<QueryInput>, strategies: Record<string, string>): { filter: TradeFilter; symbol: string | null; notes: string[] } {
  const notes: string[] = [];
  const f: TradeFilter = {};
  if (q.from && DAY.test(q.from)) f.from = q.from;
  if (q.to && DAY.test(q.to)) f.to = q.to;
  if (q.segment && (SEGMENTS as readonly string[]).includes(q.segment)) f.segment = q.segment as TradeFilter["segment"];
  if (q.strategy) {
    if (q.strategy.toLowerCase() === "none") f.strategyId = "none";
    else {
      const id = Object.entries(strategies).find(([, n]) => n.toLowerCase() === q.strategy!.toLowerCase())?.[0];
      if (id) f.strategyId = id;
      else notes.push(`No strategy named "${q.strategy}"; strategy filter ignored.`);
    }
  }
  if (q.tag) f.tag = q.tag;
  if (q.plan) f.plan = q.plan;
  if (q.expiry) f.expiry = q.expiry;
  if (q.time_from && HHMM.test(q.time_from)) f.timeFrom = q.time_from;
  if (q.time_to && HHMM.test(q.time_to)) f.timeTo = q.time_to;
  const emo = q.emotions?.filter((e) => (EMOTIONS as readonly string[]).includes(e));
  if (emo?.length) f.emotions = emo;
  if (q.stop_loss) f.stopLoss = q.stop_loss;
  if (q.direction) f.direction = q.direction;
  return { filter: f, symbol: q.symbol ? q.symbol.trim().toUpperCase() : null, notes };
}

export function executeQuery(trades: QueryTrade[], q: Partial<QueryInput>, ctx: { strategies: Record<string, string>; capital?: number }) {
  const { filter, symbol, notes } = toFilter(q, ctx.strategies);
  let matched = applyFilter(trades, filter);
  if (symbol) matched = matched.filter((t) => t.underlying === symbol);
  const description = [describeFilter(filter, { strategies: ctx.strategies }), symbol].filter((x) => x && x !== "All trades").join(" · ") || "All trades";
  const result: Record<string, unknown> = {
    filter: description,
    stats: packStats(computeStats(matched, { capital: ctx.capital })),
  };
  if (q.group_by && REPORTS.some((r) => r.key === q.group_by)) {
    result.groups = groupReport(q.group_by, matched, { strategies: ctx.strategies, capital: ctx.capital }).map((r) => ({
      group: r.label,
      trades: r.stats.count,
      win_rate_pct: Math.round(r.stats.winRate * 10) / 10,
      net_pnl_inr: Math.round(r.stats.net),
      avg_per_trade_inr: Math.round(r.stats.expectancy),
    }));
  }
  if (notes.length) result.notes = notes;
  if (matched.length === 0) result.notes = [...notes, "No trades match this filter."];
  return result;
}
