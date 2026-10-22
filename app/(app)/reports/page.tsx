import clsx from "clsx";
import { ArrowRight, GitCompare, Lightbulb } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/reports/FilterBar";
import { GroupBarChart } from "@/components/reports/GroupBarChart";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { applyFilter, filterToParams, parseFilter } from "@/lib/filters";
import { loadFilterOptions, loadReportTrades } from "@/lib/report-data";
import { groupReport, REPORTS, reportInsights, type ReportKey } from "@/lib/reports";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Reports" };

type Search = Record<string, string | string[] | undefined>;

const HORIZONTAL: ReportKey[] = ["segment", "symbol", "strategy", "tag", "emotion"];

const INTRO: Record<ReportKey, string> = {
  day: "Are some weekdays consistently better or worse for you?",
  time: "When in the session do you make and lose money? Entry time, IST.",
  segment: "Options, futures, intraday or delivery: where does your edge (or leak) come from?",
  symbol: "Which underlyings work for you, and which keep costing you?",
  strategy: "Which playbooks actually pay? Trades without a strategy are their own row.",
  tag: "Your mistakes and best setups, in rupees. A trade with two tags counts in both.",
  emotion: "How you felt before entering, and what it cost or earned.",
  expiry: "Expiry days (when the contract you traded expires) vs every other day. Weekly expiries make these days fast and risky.",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const tab = (REPORTS.find((r) => r.key === sp.tab)?.key ?? "day") as ReportKey;
  const bucket = sp.bucket === "15" ? 15 : 30;
  const filter = parseFilter(sp);

  const [all, options] = await Promise.all([loadReportTrades(user.id, filter), loadFilterOptions(user.id)]);
  const trades = applyFilter(all, filter);
  const rows = groupReport(tab, trades, { strategies: options.strategyNames, bucketMinutes: bucket, capital: user.profile?.capital });
  const insights = reportInsights(rows, tab === "time" && bucket === 15 ? 3 : 5);
  const net = trades.reduce((s, t) => s + t.netPnl, 0);

  const href = (patch: { tab?: string; bucket?: string }) => {
    const p = filterToParams(filter);
    const t = patch.tab ?? tab;
    if (t !== "day") p.set("tab", t);
    const b = patch.bucket ?? (tab === "time" ? String(bucket) : undefined);
    if (t === "time" && b === "15") p.set("bucket", "15");
    const q = p.toString();
    return q ? `/reports?${q}` : "/reports";
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description={<>{trades.length} trades · net <Money value={net} pnl /></>}
        actions={
          <Link href="/reports/compare" className="btn-ghost">
            <GitCompare size={16} /> Compare two sets
          </Link>
        }
      />
      <FilterBar
        action="/reports"
        filter={filter}
        strategies={options.strategies}
        tags={options.tags}
        keep={{ tab: tab === "day" ? undefined : tab, bucket: tab === "time" && bucket === 15 ? "15" : undefined }}
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 text-sm">
        {REPORTS.map((r) => (
          <Link
            key={r.key}
            href={href({ tab: r.key })}
            scroll={false}
            className={clsx("whitespace-nowrap rounded-md px-3 py-1.5", r.key === tab ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {trades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">No trades match these filters.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{INTRO[tab]}</p>
            {tab === "time" && (
              <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
                {(["15", "30"] as const).map((b) => (
                  <Link key={b} href={href({ bucket: b })} scroll={false} className={clsx("rounded-md px-2.5 py-1", String(bucket) === b ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
                    {b} min
                  </Link>
                ))}
              </div>
            )}
          </div>

          {insights && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Insight tone="profit" title={`Best: ${insights.best.label}`}>
                <Money value={insights.best.stats.net} pnl /> over {insights.best.stats.count} trades · {insights.best.stats.winRate.toFixed(0)}% wins
              </Insight>
              <Insight tone="loss" title={`Worst: ${insights.worst.label}`}>
                <Money value={insights.worst.stats.net} pnl /> over {insights.worst.stats.count} trades · {insights.worst.stats.winRate.toFixed(0)}% wins
              </Insight>
            </div>
          )}

          <Card title={`Net P&L by ${REPORTS.find((r) => r.key === tab)!.label.toLowerCase()}`}>
            <GroupBarChart
              horizontal={HORIZONTAL.includes(tab)}
              data={rows.map((r) => ({ label: r.label, value: r.stats.net, count: r.stats.count, winRate: r.stats.winRate }))}
            />
          </Card>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="tabular w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{REPORTS.find((r) => r.key === tab)!.label}</th>
                  <th className="px-3 py-2.5 text-right font-medium">Trades</th>
                  <th className="px-3 py-2.5 text-right font-medium">Win rate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Net P&amp;L</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg / trade</th>
                  <th className="px-3 py-2.5 text-right font-medium">Profit factor</th>
                  <th className="px-3 py-2.5 text-right font-medium">Avg win / loss</th>
                  <th className="px-3 py-2.5 text-right font-medium">Charges</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 font-medium">{r.label}</td>
                    <td className="px-3 py-2.5 text-right">{r.stats.count}</td>
                    <td className="px-3 py-2.5 text-right">{r.stats.winRate.toFixed(0)}%</td>
                    <td className="px-3 py-2.5 text-right font-medium"><Money value={r.stats.net} pnl /></td>
                    <td className="px-3 py-2.5 text-right"><Money value={r.stats.expectancy} pnl /></td>
                    <td className="px-3 py-2.5 text-right">{r.stats.profitFactor == null ? "∞" : r.stats.profitFactor.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-muted">
                      <Money value={r.stats.avgWin} /> / <Money value={r.stats.avgLoss} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-warn"><Money value={r.stats.totalCharges} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tab === "expiry" && (
            <Link href="/reports/compare?preset=expiry" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
              Compare expiry vs non-expiry side by side <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function Insight({ tone, title, children }: { tone: "profit" | "loss"; title: string; children: React.ReactNode }) {
  return (
    <div className={clsx("flex gap-3 rounded-xl border p-3", tone === "profit" ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5")}>
      <Lightbulb size={18} className={clsx("mt-0.5 shrink-0", tone === "profit" ? "text-profit" : "text-loss")} />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted">{children}</div>
      </div>
    </div>
  );
}
