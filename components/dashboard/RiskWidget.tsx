import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { formatDateIST } from "@/lib/format";
import { RULE_LABELS, type RuleStatus } from "@/lib/rules";
import type { RiskRule } from "@/lib/types";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function StatusValue({ s }: { s: RuleStatus }) {
  switch (s.rule) {
    case "DAILY_LOSS":
    case "PER_TRADE_LOSS":
      return <><Money value={s.current} /> <span className="text-muted">of</span> <Money value={s.limit} /></>;
    case "TRADE_COUNT":
      return <>{s.current} <span className="text-muted">of</span> {s.limit}</>;
    case "CONSEC_LOSSES":
      return <>{s.current} <span className="text-muted">of</span> {s.limit} losses</>;
    case "TIME_CUTOFF":
      return s.current > 0 ? <>{s.current} trade{s.current > 1 ? "s" : ""} after {hhmm(s.limit)}</> : <>none after {hhmm(s.limit)}</>;
  }
}

function breachText(b: { rule: string; value: number; limit: number }) {
  switch (b.rule as RiskRule) {
    case "DAILY_LOSS": return <>Day loss <Money value={b.value} /> (limit <Money value={b.limit} />)</>;
    case "PER_TRADE_LOSS": return <>Trade lost <Money value={b.value} /> (limit <Money value={b.limit} />)</>;
    case "TRADE_COUNT": return <>Trade #{b.value} (limit {b.limit})</>;
    case "CONSEC_LOSSES": return <>Traded after {b.value} losses in a row</>;
    case "TIME_CUTOFF": return <>Entered at {hhmm(b.value)} (cut-off {hhmm(b.limit)})</>;
  }
}

/**
 * Today's risk-rule status plus recent history. Every state shows an icon and a
 * word (OK / Close / Broken), never colour alone.
 */
export function RiskWidget({
  today,
  todayTrades,
  statuses,
  history,
  recent,
}: {
  today: string;
  todayTrades: number;
  statuses: RuleStatus[];
  history: { date: string; breaches: number }[];
  recent: { id: string; date: string; rule: string; value: number; limit: number; tradeId: string | null }[];
}) {
  if (statuses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
        No risk rules set. <Link href="/settings#risk" className="text-accent underline">Set your limits</Link> to get alerts when you break them.
      </div>
    );
  }
  const brokenToday = statuses.filter((s) => s.state === "breached").length;
  const breachDays = history.filter((h) => h.breaches > 0).length;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
          <ShieldAlert size={16} /> Risk rules · today ({formatDateIST(today)})
        </h2>
        <Link href="/settings#risk" className="text-muted hover:text-fg" aria-label="Edit risk rules"><Settings size={15} /></Link>
      </div>

      {todayTrades === 0 ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-profit"><CheckCircle2 size={16} /> No trades yet today. All rules clear.</p>
      ) : brokenToday > 0 ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-loss"><AlertTriangle size={16} /> {brokenToday} rule{brokenToday > 1 ? "s" : ""} broken today. Consider stopping for the day.</p>
      ) : (
        <p className="mb-3 flex items-center gap-2 text-sm text-profit"><CheckCircle2 size={16} /> Within all your rules so far.</p>
      )}

      <ul className="space-y-2.5">
        {statuses.map((s) => (
          <li key={s.rule}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span>{s.label}</span>
              <span className="tabular flex items-center gap-2 text-xs">
                <StatusValue s={s} />
                <span
                  className={clsx(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    s.state === "ok" && "bg-profit/15 text-profit",
                    s.state === "warning" && "bg-warn/15 text-warn",
                    s.state === "breached" && "bg-loss/15 text-loss",
                  )}
                >
                  {s.state === "ok" ? "OK" : s.state === "warning" ? "Close" : "Broken"}
                </span>
              </span>
            </div>
            {s.rule !== "TIME_CUTOFF" && (
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className={clsx("h-full rounded-full", s.state === "breached" ? "bg-loss" : s.state === "warning" ? "bg-warn" : "bg-profit")}
                  style={{ width: `${Math.min(100, s.used * 100)}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>Last {history.length} trading days</span>
          <span>Rules broken on {breachDays} of {history.length} days</span>
        </div>
        <div className="flex gap-1" role="list" aria-label="Rule breaches by day">
          {history.map((h) => (
            <Link
              key={h.date}
              role="listitem"
              href={`/journal/${h.date}`}
              title={`${formatDateIST(h.date)}: ${h.breaches ? `${h.breaches} breach${h.breaches > 1 ? "es" : ""}` : "clean"}`}
              className={clsx("h-6 flex-1 rounded-sm", h.breaches ? "bg-loss/70 hover:bg-loss" : "bg-profit/40 hover:bg-profit/70")}
            >
              <span className="sr-only">{h.date}: {h.breaches} breaches</span>
            </Link>
          ))}
        </div>
        {recent.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {recent.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="text-muted">{formatDateIST(b.date)} · {RULE_LABELS[b.rule as RiskRule]}:</span> {breachText(b)}
                </span>
                {b.tradeId && <Link href={`/trades/${b.tradeId}`} className="shrink-0 text-accent hover:underline">View</Link>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
