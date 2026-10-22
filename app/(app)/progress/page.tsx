import clsx from "clsx";
import { Flame, Trophy } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { DisciplineGrid } from "@/components/progress/DisciplineGrid";
import { ScoreTrend } from "@/components/progress/ScoreTrend";
import { LensScoreCard } from "@/components/score/LensScoreCard";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { SCORE_NAME } from "@/config/brand";
import { db } from "@/lib/db";
import { formatDateIST, istDateKey } from "@/lib/format";
import { disciplineByDay, rollingScore, streaks, weeklyRows } from "@/lib/progress";
import { RULE_LABELS } from "@/lib/rules";
import { scoreForTrades } from "@/lib/score";
import type { RiskRule } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Progress" };

const WINDOW = 20;

export default async function ProgressPage() {
  const user = await getCurrentUser();
  const capital = user.profile?.capital;
  const [trades, breaches] = await Promise.all([
    db.trade.findMany({
      where: { userId: user.id },
      select: { entryAt: true, exitAt: true, netPnl: true, grossPnl: true, totalCharges: true, rMultiple: true, points: true, underlying: true, followedPlan: true },
      orderBy: { entryAt: "asc" },
    }),
    db.ruleBreach.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
  ]);

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Progress" />
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No trades yet. <Link href="/trades/import" className="text-accent underline">Import your trades</Link> to track progress.
        </div>
      </>
    );
  }

  const breachCount = new Map<string, number>();
  for (const b of breaches) breachCount.set(b.date, (breachCount.get(b.date) ?? 0) + 1);
  const breachDates = new Set(breachCount.keys());
  const days = disciplineByDay(trades, breachCount);
  const { current, best } = streaks(days);

  // Current vs previous 20-trading-day windows.
  const dates = days.map((d) => d.date);
  const inDays = (set: string[]) => {
    const s = new Set(set);
    return trades.filter((t) => s.has(istDateKey(t.entryAt)));
  };
  const recentDates = dates.slice(-WINDOW);
  const prevDates = dates.slice(-2 * WINDOW, -WINDOW);
  const nowScore = scoreForTrades(inDays(recentDates), breachDates, capital);
  const prevScore = prevDates.length ? scoreForTrades(inDays(prevDates), breachDates, capital) : null;
  const delta = nowScore && prevScore ? nowScore.total - prevScore.total : null;
  const recentDays = days.slice(-WINDOW);
  const cleanRecent = recentDays.filter((d) => d.disciplined).length;

  const trend = rollingScore(trades, breachDates, { window: WINDOW, capital });
  const weeks = weeklyRows(trades, breachCount, capital).slice(0, 10);

  const byRule = new Map<string, { count: number; last: string }>();
  for (const b of breaches) {
    const r = byRule.get(b.rule) ?? { count: 0, last: b.date };
    r.count++;
    byRule.set(b.rule, r);
  }
  const ruleRows = [...byRule.entries()].sort((a, b) => b[1].count - a[1].count);
  const maxRule = Math.max(1, ...ruleRows.map(([, r]) => r.count));

  return (
    <>
      <PageHeader title="Progress" description={`Is your process getting better? ${SCORE_NAME} and discipline over time.`} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`${SCORE_NAME} (last ${WINDOW} days)`}
          value={nowScore ? nowScore.total : "—"}
          sub={delta == null ? nowScore?.grade : <span className={delta >= 0 ? "text-profit" : "text-loss"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous {WINDOW} days</span>}
        />
        <StatCard label="Disciplined-day streak" value={<span className="flex items-center gap-2">{current}<Flame size={20} className={current > 0 ? "text-warn" : "text-muted"} aria-hidden /></span>} sub="days in a row with no rule breach or broken plan" />
        <StatCard label="Best streak" value={<span className="flex items-center gap-2">{best}<Trophy size={20} className="text-muted" aria-hidden /></span>} sub="your record so far" />
        <StatCard label={`Disciplined days (last ${WINDOW})`} value={`${cleanRecent} / ${recentDays.length}`} sub={`${Math.round((cleanRecent / Math.max(1, recentDays.length)) * 100)}% of trading days`} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card title={`${SCORE_NAME} over time (rolling ${WINDOW} trading days)`}>
          <ScoreTrend data={trend} />
        </Card>
        <LensScoreCard score={nowScore} compact scope={`Last ${WINDOW} trading days`} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card title="Discipline calendar (last 12 weeks)">
          <DisciplineGrid days={days} />
        </Card>
        <Card title="Risk-rule breaches">
          {ruleRows.length === 0 ? (
            <p className="text-sm text-muted">No breaches recorded. <Link href="/settings#risk" className="text-accent underline">Set your risk rules</Link> to start tracking.</p>
          ) : (
            <ul className="space-y-3">
              {ruleRows.map(([rule, r]) => (
                <li key={rule}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{RULE_LABELS[rule as RiskRule] ?? rule}</span>
                    <span className="tabular text-muted">{r.count} · last {formatDateIST(r.last)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full rounded-full bg-loss" style={{ width: `${(r.count / maxRule) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Rules are checked on every trade. Change them in <Link href="/settings#risk" className="text-accent underline">Settings</Link>.</p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="tabular w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Week of</th>
              <th className="px-3 py-2.5 text-right font-medium">Trades</th>
              <th className="px-3 py-2.5 text-right font-medium">Win rate</th>
              <th className="px-3 py-2.5 text-right font-medium">Net P&amp;L</th>
              <th className="px-3 py-2.5 text-right font-medium">{SCORE_NAME}</th>
              <th className="px-3 py-2.5 text-right font-medium">Disciplined days</th>
              <th className="px-3 py-2.5 text-right font-medium">Breaches</th>
              <th className="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.week} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5">{formatDateIST(w.week)}</td>
                <td className="px-3 py-2.5 text-right">{w.trades}</td>
                <td className="px-3 py-2.5 text-right">{w.winRate.toFixed(0)}%</td>
                <td className="px-3 py-2.5 text-right"><Money value={w.net} pnl /></td>
                <td className="px-3 py-2.5 text-right">{w.score ?? <span className="text-muted" title="Needs 10+ trades">—</span>}</td>
                <td className={clsx("px-3 py-2.5 text-right", w.disciplinedDays === w.tradingDays ? "text-profit" : "")}>{w.disciplinedDays} / {w.tradingDays}</td>
                <td className={clsx("px-3 py-2.5 text-right", w.breaches > 0 && "text-loss")}>{w.breaches}</td>
                <td className="px-3 py-2.5 text-right"><Link href={`/coach?tab=weekly&week=${w.week}`} className="text-xs text-accent hover:underline">AI review</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
