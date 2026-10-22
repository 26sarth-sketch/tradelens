import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ViewValue } from "@/components/ui/ViewValue";
import { istDateKey } from "@/lib/format";
import type { DayStat, View } from "@/lib/stats";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * Diverging intensity: profit (green) / loss (red) arms with 4 equal steps each,
 * scaled to the month's largest absolute day. Every cell also prints its signed
 * value, so colour is never the only cue (red/green is hard for colour-blind users).
 */
function cellTone(value: number, maxAbs: number) {
  if (value === 0 || maxAbs === 0) return "bg-surface-2";
  const step = Math.min(3, Math.floor((Math.abs(value) / maxAbs) * 4));
  const profit = ["bg-profit/10", "bg-profit/20", "bg-profit/30", "bg-profit/45"];
  const loss = ["bg-loss/10", "bg-loss/20", "bg-loss/30", "bg-loss/45"];
  return (value > 0 ? profit : loss)[step];
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function PnlCalendar({
  days,
  month,
  view,
  monthHref,
}: {
  days: DayStat[];
  month: string; // "YYYY-MM"
  view: View;
  monthHref: (month: string) => string;
}) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = istDateKey(new Date());

  // Build Mon–Fri weeks covering the month.
  type Cell = { date: string; inMonth: boolean } | null;
  const weeks: Cell[][] = [];
  let week: Cell[] = [null, null, null, null, null];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
    if (wd === 0 || wd === 6) {
      if (wd === 0 && week.some(Boolean)) {
        weeks.push(week);
        week = [null, null, null, null, null];
      }
      continue;
    }
    week[wd - 1] = { date, inMonth: true };
  }
  if (week.some(Boolean)) weeks.push(week);

  const monthDays = days.filter((d) => d.date.startsWith(month) && d.valued > 0);
  const maxAbs = Math.max(0, ...monthDays.map((d) => Math.abs(d.value)));
  const monthTotal = monthDays.reduce((s, d) => s + d.value, 0);
  const greenDays = monthDays.filter((d) => d.value > 0).length;
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={monthHref(shiftMonth(month, -1))} aria-label="Previous month" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <ChevronLeft size={18} />
          </Link>
          <span className="min-w-36 text-center text-sm font-medium">{label}</span>
          <Link href={monthHref(shiftMonth(month, 1))} aria-label="Next month" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <ChevronRight size={18} />
          </Link>
        </div>
        <div className="text-xs text-muted">
          {monthDays.length} trading days · {greenDays} green · Month{" "}
          <ViewValue view={view} value={monthTotal} pnl className="font-medium" />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,0.9fr)] gap-1.5 text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 pb-1 text-muted">{d}</div>
        ))}
        <div className="px-1 pb-1 text-right text-muted">Week</div>

        {weeks.map((w, wi) => {
          const weekStats = w.flatMap((c) => (c && byDate.get(c.date)?.valued ? [byDate.get(c.date)!] : []));
          const weekTotal = weekStats.reduce((s, d) => s + d.value, 0);
          return [
            ...w.map((c, ci) => {
              if (!c) return <div key={`${wi}-${ci}`} className="min-h-16 rounded-lg" />;
              const s = byDate.get(c.date);
              const dayNum = Number(c.date.slice(8));
              return (
                <Link
                  key={c.date}
                  href={`/journal/${c.date}`}
                  title={s ? `${s.trades} trade${s.trades > 1 ? "s" : ""}, ${s.wins} win${s.wins === 1 ? "" : "s"}` : "No trades"}
                  className={clsx(
                    "flex min-h-16 flex-col justify-between rounded-lg border p-1.5 transition-all duration-150 hover:z-10 hover:scale-[1.05] hover:border-accent sm:p-2",
                    s && s.valued > 0 ? cellTone(s.value, maxAbs) : s ? "bg-surface-2" : "bg-surface",
                    c.date === today ? "border-accent" : "border-transparent",
                  )}
                >
                  <span className="text-muted">{dayNum}</span>
                  {s && (
                    <span className="flex flex-col">
                      {s.valued > 0 ? (
                        <ViewValue view={view} value={s.value} signed compact className="font-medium text-fg" />
                      ) : (
                        <span className="text-muted" title={view === "r" ? "No trades with a stop-loss" : "No index trades"}>—</span>
                      )}
                      <span className="hidden text-[10px] text-muted sm:inline">{s.trades} trade{s.trades > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </Link>
              );
            }),
            <div key={`wk-${wi}`} className="flex min-h-16 flex-col items-end justify-center rounded-lg bg-surface p-1.5 sm:p-2">
              {weekStats.length > 0 ? (
                <>
                  <ViewValue view={view} value={weekTotal} pnl compact className="font-medium" />
                  <span className="hidden text-[10px] text-muted sm:inline">{weekStats.length}d</span>
                </>
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>,
          ];
        })}
      </div>
    </div>
  );
}
