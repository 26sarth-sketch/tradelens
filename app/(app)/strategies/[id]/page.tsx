import clsx from "clsx";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { StatCard } from "@/components/dashboard/StatCard";
import { MissedTradeForm } from "@/components/strategies/MissedTradeForm";
import { MissedTradeList } from "@/components/strategies/MissedTradeList";
import { RHistogram } from "@/components/strategies/RHistogram";
import { Card } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Money } from "@/components/ui/Money";
import { db } from "@/lib/db";
import { formatDateIST, istDateKey } from "@/lib/format";
import { rDistribution, ruleAdherence } from "@/lib/playbook";
import { computeStats, dailyStats, equityCurve } from "@/lib/stats";
import { parseIdList, parseRules } from "@/lib/strategies";
import { getCurrentUser } from "@/lib/user";
import { deleteStrategy } from "../actions";

export const metadata = { title: "Strategy" };

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const s = await db.strategy.findFirst({ where: { id, userId: user.id } });
  if (!s) notFound();

  const [trades, missed] = await Promise.all([
    db.trade.findMany({
      where: { userId: user.id, strategyId: s.id },
      include: { ruleChecks: { where: { strategyId: s.id } } },
      orderBy: { exitAt: "asc" },
    }),
    db.missedTrade.findMany({
      where: { userId: user.id, strategyId: s.id },
      include: { strategy: { select: { name: true, color: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  const rules = { entry: parseRules(s.entryRules), exit: parseRules(s.exitRules), risk: parseRules(s.riskRules) };
  const stats = computeStats(trades, { capital: user.profile?.capital });
  const dist = rDistribution(trades.map((t) => t.rMultiple));
  const curve = equityCurve(dailyStats(trades));
  const adherence = ruleAdherence(
    rules,
    trades.map((t) => ({ netPnl: t.netPnl, checkedRules: t.ruleChecks[0] ? parseIdList(t.ruleChecks[0].checkedRules) : null })),
  );
  const reviewed = adherence[0]?.reviewed ?? 0;

  return (
    <>
      <Link href="/strategies" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Strategies
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.color }} aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
          </div>
          {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/strategies/${s.id}/edit`} className="btn-ghost"><Pencil size={16} /> Edit</Link>
          <form action={deleteStrategy}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton message={`Delete "${s.name}"? Its ${trades.length} trades stay in your journal without a strategy.`} className="btn-ghost text-loss">
              <Trash2 size={16} /> Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="mb-4 rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No trades tagged with this strategy yet. Pick it on a trade&apos;s review form to start tracking it.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label="Net P&L" value={<Money value={stats.net} pnl />} sub={`${stats.count} trades`} />
            <StatCard label="Win rate" value={`${stats.winRate.toFixed(1)}%`} sub={`${stats.wins}W · ${stats.losses}L`} />
            <StatCard label="Profit factor" value={stats.profitFactor == null ? "∞" : stats.profitFactor.toFixed(2)} />
            <StatCard label="Expectancy" value={<Money value={stats.expectancy} pnl />} sub="per trade" />
            <StatCard label="Avg R" value={dist.avgR != null ? `${dist.avgR >= 0 ? "+" : ""}${dist.avgR.toFixed(2)}R` : "—"} sub={`${dist.withR} with stop-loss`} />
            <StatCard label="Max drawdown" value={<Money value={-stats.maxDrawdown} className="text-loss" />} />
          </div>
          <div className="mb-4 grid gap-4 xl:grid-cols-2">
            <Card title="Equity curve"><EquityCurve data={curve} view="inr" /></Card>
            <Card title="R-multiple distribution"><RHistogram dist={dist} /></Card>
          </div>
        </>
      )}

      <Card title="Rules and how often you follow them" className="mb-4">
        {reviewed === 0 ? (
          <p className="mb-3 text-xs text-muted">No checklists filled in yet. Tick the rules you followed on each trade&apos;s review form.</p>
        ) : (
          <p className="mb-3 text-xs text-muted">Based on {reviewed} trades with a filled-in checklist.</p>
        )}
        <div className="overflow-x-auto">
          <table className="tabular w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Rule</th>
                <th className="px-3 py-2 text-right font-medium">Followed</th>
                <th className="px-3 py-2 text-right font-medium">Win rate when followed</th>
                <th className="py-2 pl-3 text-right font-medium">when broken</th>
              </tr>
            </thead>
            <tbody>
              {adherence.map((a) => (
                <tr key={a.rule.id} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    <span className="mr-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">{a.group}</span>
                    {a.rule.text}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.followedPct == null ? "—" : (
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:inline-block" aria-hidden>
                          <span className="block h-full bg-accent" style={{ width: `${a.followedPct}%` }} />
                        </span>
                        {a.followedPct.toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{a.winRateFollowed == null ? "—" : `${a.winRateFollowed.toFixed(0)}%`}</td>
                  <td className={clsx("py-2 pl-3 text-right", a.winRateBroken != null && a.winRateFollowed != null && a.winRateBroken < a.winRateFollowed && "text-loss")}>
                    {a.winRateBroken == null ? "—" : `${a.winRateBroken.toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Recent trades">
          {trades.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
            <ul className="divide-y divide-border text-sm">
              {trades.slice(-10).reverse().map((t) => (
                <li key={t.id}>
                  <Link href={`/trades/${t.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                    <span className="truncate"><span className="text-muted">{formatDateIST(t.entryAt)}</span> <span className="font-medium">{t.symbol}</span></span>
                    <span className="flex items-center gap-3">
                      {t.rMultiple != null && <span className="text-xs text-muted">{t.rMultiple.toFixed(2)}R</span>}
                      <Money value={t.netPnl} pnl />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Missed trades for this strategy">
          <MissedTradeForm strategies={[{ id: s.id, name: s.name }]} defaultStrategyId={s.id} today={istDateKey(new Date())} />
          <div className="mt-4"><MissedTradeList items={missed} showStrategy={false} /></div>
        </Card>
      </div>
    </>
  );
}
