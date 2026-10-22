import clsx from "clsx";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import Link from "next/link";
import { DayNotes } from "@/components/journal/DayNotes";
import { PlanForm } from "@/components/notebook/PlanForm";
import { ReflectionForm } from "@/components/notebook/ReflectionForm";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateIST, fromIST, isDayKey, istDateKey } from "@/lib/format";
import { comparePlan } from "@/lib/plan";
import { parseIdList } from "@/lib/strategies";
import { getCurrentUser } from "@/lib/user";
import { MoneyText } from "@/components/ui/MoneyText";

export const metadata = { title: "Notebook" };

function shiftDay(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + delta);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export default async function NotebookPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const today = istDateKey(new Date());
  const date = sp.date && isDayKey(sp.date) ? sp.date : today;

  const [entry, strategies, trades, recent] = await Promise.all([
    db.dailyJournal.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    db.strategy.findMany({ where: { userId: user.id }, select: { id: true, name: true, color: true }, orderBy: { createdAt: "asc" } }),
    db.trade.findMany({
      where: { userId: user.id, entryAt: { gte: fromIST(date, "00:00"), lte: fromIST(date, "23:59:59") } },
      select: { entryAt: true, netPnl: true, strategyId: true, followedPlan: true },
    }),
    db.dailyJournal.findMany({
      where: { userId: user.id, OR: [{ planMaxTrades: { not: null } }, { eodRating: { not: null } }] },
      orderBy: { date: "desc" },
      take: 8,
    }),
  ]);

  const p = user.profile;
  // New plans start from the trader's standing risk rules.
  const planInitial = {
    planMaxTrades: entry?.planMaxTrades ?? p?.maxTradesPerDay ?? null,
    planMaxLoss: entry?.planMaxLoss ?? p?.maxDailyLoss ?? null,
    planStrategyIds: entry ? parseIdList(entry.planStrategyIds) : parseIdList(p?.preferredStrategyIds),
    planMood: entry?.planMood ?? null,
    planNotes: entry?.planNotes ?? "",
  };
  const hasPlan = entry?.planMaxTrades != null || entry?.planMaxLoss != null || (entry && parseIdList(entry.planStrategyIds).length > 0);
  const checks = hasPlan
    ? comparePlan(
        { planMaxTrades: entry!.planMaxTrades, planMaxLoss: entry!.planMaxLoss, planStrategyIds: parseIdList(entry!.planStrategyIds) },
        trades,
        Object.fromEntries(strategies.map((s) => [s.id, s.name])),
      )
    : [];
  const net = trades.reduce((s, t) => s + t.netPnl, 0);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Notebook" description="Plan before the bell, reflect after the close." />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/notebook?date=${shiftDay(date, -1)}`} aria-label="Previous day" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><ChevronLeft size={18} /></Link>
        <span className="min-w-56 text-center font-medium">{label}{date === today && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">Today</span>}</span>
        <Link href={`/notebook?date=${shiftDay(date, 1)}`} aria-label="Next day" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><ChevronRight size={18} /></Link>
        <input type="date" name="date" defaultValue={date} className="input w-auto py-1" aria-label="Pick a date" />
        <button className="btn-ghost py-1">Go</button>
        {date !== today && <Link href="/notebook" className="text-sm text-accent hover:underline">Back to today</Link>}
      </form>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Pre-market plan">
          {/* key: remount with fresh defaults when the date changes */}
          <PlanForm key={date} date={date} initial={planInitial} strategies={strategies} />
        </Card>

        <Card title="Plan vs what actually happened">
          {trades.length === 0 ? (
            <p className="text-sm text-muted">No trades on this day {date === today ? "yet" : ""}. Your plan will be checked against them automatically.</p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                {trades.length} trade{trades.length > 1 ? "s" : ""} · net <Money value={net} pnl className="font-medium" />
              </p>
              {!hasPlan ? (
                <p className="text-sm text-muted">No plan was saved for this day, so there&apos;s nothing to check against.</p>
              ) : (
                <ul className="space-y-2.5">
                  {checks.map((c) => (
                    <li key={c.key} className="flex gap-2 text-sm">
                      {c.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-profit" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-loss" />}
                      <div>
                        <div className="font-medium">{c.label} <span className={clsx("text-xs font-normal", c.ok ? "text-profit" : "text-loss")}>{c.ok ? "kept" : "broken"}</span></div>
                        <div className="text-xs text-muted"><MoneyText text={c.detail} /></div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/journal/${date}`} className="mt-4 inline-block text-xs text-accent hover:underline">See the day&apos;s trades →</Link>
            </>
          )}
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="End-of-day reflection">
          <ReflectionForm
            key={date}
            date={date}
            initial={{ eodWentWell: entry?.eodWentWell ?? "", eodToImprove: entry?.eodToImprove ?? "", eodRating: entry?.eodRating ?? null }}
          />
        </Card>
        <Card title="Free notes">
          <DayNotes key={date} date={date} initial={entry?.notes ?? ""} rows={6} />
        </Card>
      </div>

      {recent.length > 0 && (
        <Card title="Recent entries">
          <ul className="divide-y divide-border text-sm">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/notebook?date=${r.date}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                  <span>{formatDateIST(r.date)}</span>
                  <span className="flex items-center gap-3 text-xs text-muted">
                    {r.planMaxTrades != null && <span>Plan: max {r.planMaxTrades} trades</span>}
                    {r.eodRating != null && <span>Discipline {"★".repeat(r.eodRating)}{"☆".repeat(5 - r.eodRating)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
