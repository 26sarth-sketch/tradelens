import clsx from "clsx";
import { ArrowRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { DayNotes } from "@/components/journal/DayNotes";
import { DaySparkline } from "@/components/journal/DaySparkline";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatTimeIST, istDateKey } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Daily Journal" };

const DAYS_PER_PAGE = 10;
const TRADES_SHOWN = 6;

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const [trades, journals] = await Promise.all([
    db.trade.findMany({
      where: { userId: user.id },
      orderBy: { entryAt: "asc" },
      select: {
        id: true, symbol: true, entryAt: true, exitAt: true, netPnl: true, grossPnl: true,
        totalCharges: true, followedPlan: true, isExpiryDay: true, emotionBefore: true,
      },
    }),
    db.dailyJournal.findMany({ where: { userId: user.id } }),
  ]);

  // Every day with trades or a journal entry, newest first.
  const byDay = new Map<string, typeof trades>();
  for (const t of trades) {
    const k = istDateKey(t.exitAt);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const journalByDay = new Map(journals.map((j) => [j.date, j]));
  const allDays = [...new Set([...byDay.keys(), ...journalByDay.keys()])].sort().reverse();

  const page = Math.max(1, Number(sp.page) || 1);
  const pages = Math.max(1, Math.ceil(allDays.length / DAYS_PER_PAGE));
  const days = allDays.slice((page - 1) * DAYS_PER_PAGE, page * DAYS_PER_PAGE);

  return (
    <>
      <PageHeader title="Daily Journal" description="Each trading day at a glance. Write a note while it's fresh." />

      {allDays.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No trading days yet. <Link href="/trades/import" className="text-accent underline">Import your trades</Link> to start your journal.
        </div>
      )}

      <div className="space-y-4">
        {days.map((date) => {
          const ts = byDay.get(date) ?? [];
          const j = journalByDay.get(date);
          const net = ts.reduce((s, t) => s + t.netPnl, 0);
          const charges = ts.reduce((s, t) => s + t.totalCharges, 0);
          const wins = ts.filter((t) => t.netPnl > 0).length;
          const reviewed = ts.filter((t) => t.followedPlan != null);
          const broke = reviewed.filter((t) => t.followedPlan === false).length;
          const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
            weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
          });
          const overPlan = j?.planMaxTrades != null && ts.length > j.planMaxTrades;

          return (
            <article key={date} className="rounded-xl border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/journal/${date}`} className="font-medium hover:text-accent">{label}</Link>
                  {ts.some((t) => t.isExpiryDay) && <Badge tone="warn">Expiry day</Badge>}
                  {j?.planMaxTrades != null && <Badge tone="muted"><NotebookPen size={11} /> Plan</Badge>}
                  {overPlan && <Badge tone="loss">{ts.length} trades vs plan of {j!.planMaxTrades}</Badge>}
                  {broke > 0 && <Badge tone="loss">Broke plan on {broke}</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <DaySparkline values={ts.map((t) => t.netPnl)} />
                  <div className="text-right">
                    <Money value={net} pnl className="text-lg font-semibold" />
                    <div className="text-xs text-muted">
                      {ts.length} trade{ts.length === 1 ? "" : "s"}
                      {ts.length > 0 && <> · {Math.round((wins / ts.length) * 100)}% wins · <Money value={charges} /> charges</>}
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 md:grid-cols-2">
                <div>
                  {ts.length === 0 ? (
                    <p className="text-sm text-muted">No trades this day.</p>
                  ) : (
                    <ul className="divide-y divide-border/60 text-sm">
                      {ts.slice(0, TRADES_SHOWN).map((t) => (
                        <li key={t.id}>
                          <Link href={`/trades/${t.id}`} className="flex items-center justify-between gap-3 py-1.5 hover:text-accent">
                            <span className="truncate">
                              <span className="tabular text-muted">{formatTimeIST(t.entryAt)}</span>{" "}
                              <span className="font-medium">{t.symbol}</span>
                              {t.emotionBefore && (
                                <span className={clsx("ml-2 text-xs", t.emotionBefore === "Revenge" || t.emotionBefore === "FOMO" ? "text-warn" : "text-muted")}>
                                  {t.emotionBefore}
                                </span>
                              )}
                            </span>
                            <Money value={t.netPnl} pnl />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {ts.length > TRADES_SHOWN && (
                    <Link href={`/journal/${date}`} className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                      +{ts.length - TRADES_SHOWN} more <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
                <DayNotes date={date} initial={j?.notes ?? ""} />
              </div>
            </article>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={`/journal?page=${page - 1}`} className="btn-ghost">Newer</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={`/journal?page=${page + 1}`} className="btn-ghost">Older</Link>}
        </div>
      )}
    </>
  );
}

function Badge({ tone, children }: { tone: "warn" | "loss" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "loss" && "bg-loss/15 text-loss",
        tone === "muted" && "bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}
