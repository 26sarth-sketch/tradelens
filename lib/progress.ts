// Progress over time: rolling Lens Score, discipline streaks and weekly summaries.
// A "disciplined day" = a trading day with no risk-rule breach and no trade the
// trader marked "didn't follow my plan".

import { istDateKey } from "./format";
import { scoreForTrades } from "./score";
import { computeStats, type StatTrade } from "./stats";

export type ProgressTrade = StatTrade & { followedPlan: boolean | null };

export type DayDiscipline = { date: string; disciplined: boolean; breaches: number; brokePlan: number; trades: number; net: number };

export function disciplineByDay(trades: ProgressTrade[], breachCount: Map<string, number>): DayDiscipline[] {
  const days = new Map<string, DayDiscipline>();
  for (const t of trades) {
    const date = istDateKey(t.entryAt);
    const d = days.get(date) ?? { date, disciplined: true, breaches: breachCount.get(date) ?? 0, brokePlan: 0, trades: 0, net: 0 };
    d.trades++;
    d.net += t.netPnl;
    if (t.followedPlan === false) d.brokePlan++;
    days.set(date, d);
  }
  return [...days.values()]
    .map((d) => ({ ...d, disciplined: d.breaches === 0 && d.brokePlan === 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Current streak (ending on the latest trading day) and best streak of disciplined days. */
export function streaks(days: DayDiscipline[]) {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.disciplined ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0 && days[i].disciplined; i--) current++;
  return { current, best };
}

/** Lens Score on a trailing window of trading days, one point per trading day. */
export function rollingScore(trades: ProgressTrade[], breachDates: Set<string>, opts: { window?: number; capital?: number } = {}) {
  const window = opts.window ?? 20;
  const byDay = new Map<string, ProgressTrade[]>();
  for (const t of trades) {
    const k = istDateKey(t.entryAt);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const dates = [...byDay.keys()].sort();
  const out: { date: string; score: number }[] = [];
  for (let i = window - 1; i < dates.length; i++) {
    const slice = dates.slice(i - window + 1, i + 1).flatMap((d) => byDay.get(d)!);
    const s = scoreForTrades(slice, breachDates, opts.capital);
    if (s) out.push({ date: dates[i], score: s.total });
  }
  return out;
}

/** Monday of the IST week containing `date`. */
export function mondayOf(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export type WeekRow = {
  week: string;
  trades: number;
  net: number;
  winRate: number;
  score: number | null;
  breaches: number;
  disciplinedDays: number;
  tradingDays: number;
};

export function weeklyRows(trades: ProgressTrade[], breachCount: Map<string, number>, capital?: number): WeekRow[] {
  const weeks = new Map<string, ProgressTrade[]>();
  for (const t of trades) {
    const w = mondayOf(istDateKey(t.entryAt));
    weeks.set(w, [...(weeks.get(w) ?? []), t]);
  }
  const breachDates = new Set([...breachCount.keys()]);
  return [...weeks.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, ts]) => {
      const s = computeStats(ts);
      const days = disciplineByDay(ts, breachCount);
      return {
        week,
        trades: ts.length,
        net: s.net,
        winRate: s.winRate,
        score: scoreForTrades(ts, breachDates, capital)?.total ?? null,
        breaches: days.reduce((sum, d) => sum + d.breaches, 0),
        disciplinedDays: days.filter((d) => d.disciplined).length,
        tradingDays: days.length,
      };
    });
}
