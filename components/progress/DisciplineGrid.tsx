import clsx from "clsx";
import Link from "next/link";
import { formatDateIST } from "@/lib/format";
import type { DayDiscipline } from "@/lib/progress";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * Weeks as rows, Mon–Fri as columns. Disciplined days are green, days with a rule
 * breach or a broken plan are red with the count printed, non-trading days are blank.
 */
export function DisciplineGrid({ days, weeks = 12 }: { days: DayDiscipline[]; weeks?: number }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const last = days.length ? days[days.length - 1].date : new Date().toISOString().slice(0, 10);
  const end = new Date(`${last}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7)); // Monday of the last week
  const rows = Array.from({ length: weeks }, (_, w) => {
    const monday = new Date(end);
    monday.setUTCDate(monday.getUTCDate() - (weeks - 1 - w) * 7);
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  });

  return (
    <div>
      <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-1 text-[10px] text-muted">
        <span />
        {WD.map((d) => <span key={d} className="text-center">{d}</span>)}
        {rows.map((week) => [
          <span key={`l${week[0]}`} className="self-center">{formatDateIST(week[0]).slice(0, 6)}</span>,
          ...week.map((date) => {
            const d = byDate.get(date);
            const issues = d ? d.breaches + d.brokePlan : 0;
            return d ? (
              <Link
                key={date}
                href={`/journal/${date}`}
                title={`${formatDateIST(date)}: ${d.disciplined ? "disciplined" : `${d.breaches} rule breach${d.breaches === 1 ? "" : "es"}, ${d.brokePlan} trade${d.brokePlan === 1 ? "" : "s"} against plan`}`}
                className={clsx(
                  "flex h-6 items-center justify-center rounded-sm text-[10px] font-medium",
                  d.disciplined ? "bg-profit/45 text-fg hover:bg-profit/70" : "bg-loss/60 text-fg hover:bg-loss/80",
                )}
              >
                {d.disciplined ? "✓" : issues}
              </Link>
            ) : (
              <span key={date} className="h-6 rounded-sm bg-surface-2/50" />
            );
          }),
        ])}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-profit/45" /> ✓ disciplined day</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-loss/60" /> number = rule breaches + trades against plan</span>
      </div>
    </div>
  );
}
