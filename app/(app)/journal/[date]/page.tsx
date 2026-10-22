import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DayNotes } from "@/components/journal/DayNotes";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { db } from "@/lib/db";
import { fromIST, formatTimeIST } from "@/lib/format";
import { computeStats } from "@/lib/stats";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Journal day" };

function shiftDay(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + delta);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

// One trading day: trades, totals, plan summary and an editable note.
// Plan and end-of-day reflection editing live in the Notebook (Day 2).
export default async function JournalDayPage({ params }: { params: Promise<{ date: string }> }) {
  const [{ date }, user] = await Promise.all([params, getCurrentUser()]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [trades, journal] = await Promise.all([
    db.trade.findMany({
      where: { userId: user.id, exitAt: { gte: fromIST(date, "00:00"), lte: fromIST(date, "23:59:59") } },
      orderBy: { entryAt: "asc" },
    }),
    db.dailyJournal.findUnique({ where: { userId_date: { userId: user.id, date } } }),
  ]);
  const s = computeStats(trades);
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <Link href="/journal" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Daily Journal
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/journal/${shiftDay(date, -1)}`} aria-label="Previous day" className="rounded-md p-1 text-muted hover:bg-surface-2"><ChevronLeft size={20} /></Link>
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <Link href={`/journal/${shiftDay(date, 1)}`} aria-label="Next day" className="rounded-md p-1 text-muted hover:bg-surface-2"><ChevronRight size={20} /></Link>
        </div>
        {trades.length > 0 && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Net P&amp;L</div>
            <Money value={s.netPnl} pnl className="text-2xl font-semibold" />
          </div>
        )}
      </div>

      {trades.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">No trades on this day.</div>
          <Card title="Notes">
            <DayNotes date={date} initial={journal?.notes ?? ""} rows={5} />
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title={`${trades.length} trades · ${s.winRate.toFixed(0)}% win rate`} className="lg:col-span-2">
            <ul className="divide-y divide-border text-sm">
              {trades.map((t) => (
                <li key={t.id}>
                  <Link href={`/trades/${t.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                    <span className="truncate">
                      <span className="text-muted">{formatTimeIST(t.entryAt)}</span> <span className="font-medium">{t.symbol}</span>
                      {t.emotionBefore && <span className="ml-2 text-xs text-muted">{t.emotionBefore}</span>}
                    </span>
                    <Money value={t.netPnl} pnl decimals />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Day summary">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Gross</dt><dd><Money value={s.grossPnl} pnl /></dd></div>
              <div className="flex justify-between"><dt className="text-muted">Charges</dt><dd><Money value={s.totalCharges} className="text-warn" /></dd></div>
              <div className="flex justify-between"><dt className="text-muted">Net</dt><dd><Money value={s.netPnl} pnl /></dd></div>
            </dl>
            {journal?.planMaxTrades != null && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                Plan: max {journal.planMaxTrades} trades, max loss <Money value={journal.planMaxLoss ?? 0} />. Mood: {journal.planMood ?? "—"}.
              </p>
            )}
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="mb-2 text-sm font-medium">Notes</h3>
              <DayNotes date={date} initial={journal?.notes ?? ""} rows={5} />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
