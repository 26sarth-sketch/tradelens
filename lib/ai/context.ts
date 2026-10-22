import "server-only";
// Builds the DATA the model sees: the trader profile plus aggregated stats computed
// in code, and a small, relevant sample of trades. Never the whole database.

import { compareMetrics, COMPARE_PRESETS } from "../compare";
import { db } from "../db";
import { applyFilter } from "../filters";
import { formatTimeIST, fromIST, istDateKey } from "../format";
import { comparePlan } from "../plan";
import { loadReportTrades } from "../report-data";
import { groupReport, type ReportKey } from "../reports";
import { limitsOf } from "../rule-store";
import { dayStatus, RULE_LABELS } from "../rules";
import { computeStats } from "../stats";
import { parseIdList, parseRules } from "../strategies";
import { excursions } from "../trades";
import type { RiskRule } from "../types";
import { packStats } from "./pack";

type ReportTrade = Awaited<ReturnType<typeof loadReportTrades>>[number];

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

function packGroups(key: ReportKey, trades: ReportTrade[], strategies: Record<string, string>, limit = 12) {
  return groupReport(key, trades, { strategies })
    .slice(0, limit)
    .map((r) => ({
      group: r.label,
      trades: r.stats.count,
      win_rate_pct: r1(r.stats.winRate),
      net_pnl_inr: r0(r.stats.net),
      avg_per_trade_inr: r0(r.stats.expectancy),
    }));
}

function packTrade(t: ReportTrade & { symbol?: string; notes?: string }, strategies: Record<string, string>) {
  return {
    id: t.id,
    date: istDateKey(t.entryAt),
    entry_time_ist: formatTimeIST(t.entryAt),
    symbol: t.symbol ?? t.underlying,
    segment: t.segment,
    net_pnl_inr: r0(t.netPnl),
    r_multiple: t.rMultiple,
    emotion_before: t.emotionBefore,
    followed_plan: t.followedPlan,
    strategy: t.strategyId ? (strategies[t.strategyId] ?? null) : null,
    tags: t.tags.filter((x) => x.accepted).map((x) => x.tag.name),
    expiry_day: t.isExpiryDay,
    notes: t.notes ? t.notes.slice(0, 200) : undefined,
  };
}

async function loadProfile(userId: string) {
  const [user, strategies] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } }),
    db.strategy.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const names = Object.fromEntries(strategies.map((s) => [s.id, s.name]));
  const p = user.profile;
  const limits = limitsOf(p);
  return {
    names,
    level: p?.level ?? "BEGINNER",
    language: p?.language ?? "EN",
    capital: p?.capital ?? 0,
    trader: {
      name: user.name,
      level: p?.level ?? "BEGINNER",
      capital_inr: p?.capital ?? null,
      broker: p?.broker ?? null,
      preferred_strategies: parseIdList(p?.preferredStrategyIds).map((id) => names[id]).filter(Boolean),
      risk_rules: {
        max_daily_loss_inr: limits.maxDailyLoss,
        max_trades_per_day: limits.maxTradesPerDay,
        max_loss_per_trade_inr: limits.maxLossPerTrade,
        stop_after_consecutive_losses: limits.maxConsecutiveLosses,
        no_new_trades_after_ist: limits.noTradeAfter,
      },
    },
  };
}

async function withNotes(userId: string, ids: string[]) {
  const rows = await db.trade.findMany({ where: { userId, id: { in: ids } }, select: { id: true, symbol: true, notes: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

/** Full-journal context: first-import analysis and the chat's background facts. */
export async function journalContext(userId: string, opts: { from?: string; to?: string } = {}) {
  const prof = await loadProfile(userId);
  const trades = applyFilter(await loadReportTrades(userId, opts), opts);
  if (trades.length === 0) return { prof, data: null, trades };

  const comparisons = Object.fromEntries(
    COMPARE_PRESETS.filter((p) => p.key !== "direction").map((p) => {
      const a = applyFilter(trades, p.a.filter);
      const b = applyFilter(trades, p.b.filter);
      const { sa, sb } = compareMetrics(a, b, prof.capital);
      return [p.key, { [p.a.name]: packStats(sa), [p.b.name]: packStats(sb) }];
    }),
  );

  const breaches = await db.ruleBreach.groupBy({ by: ["rule"], where: { userId }, _count: true });
  const breachDays = await db.ruleBreach.findMany({ where: { userId }, select: { date: true }, distinct: ["date"] });
  const days = new Set(trades.map((t) => istDateKey(t.entryAt)));

  const sorted = [...trades].sort((a, b) => a.netPnl - b.netPnl);
  const sample = [...sorted.slice(0, 5), ...sorted.slice(-3), ...trades.filter((t) => t.emotionBefore === "Revenge").slice(-3)];
  const unique = [...new Map(sample.map((t) => [t.id, t])).values()];
  const extra = await withNotes(userId, unique.map((t) => t.id));

  return {
    prof,
    trades,
    data: {
      trader: prof.trader,
      period: { from: istDateKey(trades[0].entryAt), to: istDateKey(trades[trades.length - 1].entryAt), trading_days: days.size },
      overall: packStats(computeStats(trades, { capital: prof.capital })),
      by_time_of_day_30min: packGroups("time", trades, prof.names, 13),
      by_day_of_week: packGroups("day", trades, prof.names),
      by_segment: packGroups("segment", trades, prof.names),
      by_symbol: packGroups("symbol", trades, prof.names, 8),
      by_strategy: packGroups("strategy", trades, prof.names),
      by_tag: packGroups("tag", trades, prof.names),
      by_emotion_before_entry: packGroups("emotion", trades, prof.names),
      expiry_vs_normal_days: packGroups("expiry", trades, prof.names),
      comparisons,
      risk_rule_breaches: {
        days_with_a_breach: breachDays.filter((d) => days.has(d.date)).length,
        by_rule: Object.fromEntries(breaches.map((b) => [RULE_LABELS[b.rule as RiskRule] ?? b.rule, b._count])),
      },
      sample_trades: unique.map((t) => packTrade({ ...t, ...extra.get(t.id) }, prof.names)),
    },
  };
}

/** Monday (IST day key) of the week containing `date`. */
export function weekStart(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Weekly review: this week vs the previous 4 weeks as a baseline. */
export async function weeklyContext(userId: string, monday: string) {
  const prof = await loadProfile(userId);
  const all = await loadReportTrades(userId, { from: addDays(monday, -28), to: addDays(monday, 6) });
  const week = applyFilter(all, { from: monday, to: addDays(monday, 6) });
  const base = applyFilter(all, { to: addDays(monday, -1) });
  if (week.length === 0) return { prof, data: null, trades: week };

  const sorted = [...week].sort((a, b) => a.netPnl - b.netPnl);
  const sample = [...new Map([...sorted.slice(0, 4), ...sorted.slice(-3)].map((t) => [t.id, t])).values()];
  const extra = await withNotes(userId, sample.map((t) => t.id));
  const breaches = await db.ruleBreach.findMany({ where: { userId, date: { gte: monday, lte: addDays(monday, 6) } } });
  const journals = await db.dailyJournal.findMany({ where: { userId, date: { gte: monday, lte: addDays(monday, 6) } } });

  const weekDays = new Set(week.map((t) => istDateKey(t.entryAt)));
  return {
    prof,
    trades: week,
    data: {
      trader: prof.trader,
      this_week: {
        from: monday,
        to: addDays(monday, 6),
        trading_days: weekDays.size,
        overall: packStats(computeStats(week, { capital: prof.capital })),
        by_day: packGroups("day", week, prof.names),
        by_time_of_day_30min: packGroups("time", week, prof.names, 13),
        by_emotion_before_entry: packGroups("emotion", week, prof.names),
        by_strategy: packGroups("strategy", week, prof.names),
        expiry_vs_normal_days: packGroups("expiry", week, prof.names),
        followed_plan_vs_broke: {
          followed: packStats(computeStats(applyFilter(week, { plan: "followed" }), { capital: prof.capital })),
          broke: packStats(computeStats(applyFilter(week, { plan: "broke" }), { capital: prof.capital })),
        },
        risk_rule_breaches: breaches.reduce<Record<string, number>>((acc, b) => {
          const k = RULE_LABELS[b.rule as RiskRule] ?? b.rule;
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
        days_with_written_plan: journals.filter((j) => j.planMaxTrades != null).length,
        sample_trades: sample.map((t) => packTrade({ ...t, ...extra.get(t.id) }, prof.names)),
      },
      baseline_previous_4_weeks: base.length ? packStats(computeStats(base, { capital: prof.capital })) : null,
    },
  };
}

/** Session review: one day's plan, rules and trades. */
export async function sessionContext(userId: string, date: string) {
  const prof = await loadProfile(userId);
  const trades = await loadReportTrades(userId, { from: date, to: date });
  const [journal, breaches, details] = await Promise.all([
    db.dailyJournal.findUnique({ where: { userId_date: { userId, date } } }),
    db.ruleBreach.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } }),
    withNotes(userId, trades.map((t) => t.id)),
  ]);
  const profile = await db.traderProfile.findUnique({ where: { userId } });
  const plan = journal
    ? {
        max_trades: journal.planMaxTrades,
        max_loss_inr: journal.planMaxLoss,
        strategies: parseIdList(journal.planStrategyIds).map((id) => prof.names[id]).filter(Boolean),
        mood_before_open: journal.planMood,
        notes: journal.planNotes || undefined,
      }
    : null;
  const checks = journal
    ? comparePlan({ planMaxTrades: journal.planMaxTrades, planMaxLoss: journal.planMaxLoss, planStrategyIds: parseIdList(journal.planStrategyIds) }, trades, prof.names)
    : [];
  const statuses = dayStatus(trades.map((t) => ({ id: t.id, entryAt: t.entryAt, exitAt: t.exitAt, netPnl: t.netPnl })), limitsOf(profile), fromIST(date, "15:30"));

  let running = 0;
  return {
    prof,
    trades,
    data: {
      trader: prof.trader,
      date,
      pre_market_plan: plan,
      plan_checks_computed: checks.map((c) => ({ check: c.label, kept: c.ok, detail: c.detail })),
      risk_rule_status: statuses.map((s) =>
        s.rule === "TIME_CUTOFF"
          ? { rule: s.label, state: s.state, trades_after_cutoff: s.current, cutoff_ist: `${String(Math.floor(s.limit / 60)).padStart(2, "0")}:${String(s.limit % 60).padStart(2, "0")}` }
          : { rule: s.label, state: s.state, current: r0(s.current), limit: r0(s.limit) },
      ),
      risk_rule_breaches: breaches.map((b) => ({
        rule: RULE_LABELS[b.rule as RiskRule] ?? b.rule,
        ...(b.rule === "TIME_CUTOFF"
          ? { entered_at_ist: `${String(Math.floor(b.value / 60)).padStart(2, "0")}:${String(b.value % 60).padStart(2, "0")}` }
          : { value: r0(b.value), limit: r0(b.limit) }),
        trade_id: b.tradeId,
      })),
      day: packStats(computeStats(trades, { capital: prof.capital })),
      trades_in_order: [...trades]
        .sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime())
        .map((t) => ({ ...packTrade({ ...t, ...details.get(t.id) }, prof.names), running_net_after_inr: r0((running += t.netPnl)) })),
      end_of_day_reflection: journal?.eodRating != null ? { went_well: journal.eodWentWell, to_improve: journal.eodToImprove, discipline_rating_1_to_5: journal.eodRating } : null,
    },
  };
}

/** Per-trade feedback: the trade in full, its plan and checklist, and what led up to it that day. */
export async function tradeContext(userId: string, tradeId: string) {
  const prof = await loadProfile(userId);
  const t = await db.trade.findFirst({
    where: { id: tradeId, userId },
    include: { strategy: true, ruleChecks: true, tags: { include: { tag: true } }, breaches: true },
  });
  if (!t) return { prof, data: null };

  const day = istDateKey(t.entryAt);
  const sameDay = await db.trade.findMany({
    where: { userId, entryAt: { gte: fromIST(day, "00:00"), lt: t.entryAt } },
    orderBy: { entryAt: "asc" },
    select: { symbol: true, entryAt: true, exitAt: true, netPnl: true },
  });
  const prev = sameDay.at(-1);
  const checked = t.strategyId ? parseIdList(t.ruleChecks.find((c) => c.strategyId === t.strategyId)?.checkedRules) : [];
  const rules = t.strategy
    ? (["entryRules", "exitRules", "riskRules"] as const).flatMap((k) =>
        parseRules(t.strategy![k]).map((r) => ({ group: k.replace("Rules", ""), rule: r.text, followed: checked.includes(r.id) })),
      )
    : [];
  const exc = excursions(t);

  return {
    prof,
    data: {
      trader: prof.trader,
      trade: {
        symbol: t.symbol,
        segment: t.segment,
        direction: t.direction,
        date: day,
        entry_time_ist: formatTimeIST(t.entryAt),
        exit_time_ist: formatTimeIST(t.exitAt),
        held_minutes: Math.round((t.exitAt.getTime() - t.entryAt.getTime()) / 60000),
        qty: t.qty,
        lots: t.lots,
        entry_price: t.avgEntry,
        exit_price: t.avgExit,
        gross_pnl_inr: r0(t.grossPnl),
        charges_inr: r0(t.totalCharges),
        net_pnl_inr: r0(t.netPnl),
        expiry_day: t.isExpiryDay,
        stop_loss: t.plannedSL,
        target: t.plannedTarget,
        planned_reward_to_risk: t.plannedR,
        r_multiple: t.rMultiple,
        best_open_profit_inr: exc ? r0(exc.mfe) : null,
        worst_open_loss_inr: exc ? r0(exc.mae) : null,
        left_on_table_inr: exc ? r0(exc.leftOnTable) : null,
        emotion_before: t.emotionBefore,
        emotion_after: t.emotionAfter,
        followed_plan_self_report: t.followedPlan,
        strategy: t.strategy?.name ?? null,
        strategy_checklist: rules,
        tags: t.tags.filter((x) => x.accepted).map((x) => x.tag.name),
        auto_tagger_flags: t.tags.filter((x) => !x.accepted && !x.dismissed).map((x) => ({ tag: x.tag.name, reason: x.reason })),
        risk_rules_broken: t.breaches.map((b) => RULE_LABELS[b.rule as RiskRule] ?? b.rule),
        notes: t.notes ? t.notes.slice(0, 400) : undefined,
      },
      earlier_that_day: {
        trades_before_this: sameDay.length,
        net_before_this_inr: r0(sameDay.reduce((s, x) => s + x.netPnl, 0)),
        previous_trade: prev
          ? { symbol: prev.symbol, net_pnl_inr: r0(prev.netPnl), minutes_between_exit_and_this_entry: Math.round((t.entryAt.getTime() - prev.exitAt.getTime()) / 60000) }
          : null,
      },
    },
  };
}
