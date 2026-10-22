import { Plus } from "lucide-react";
import Link from "next/link";
import { DaySparkline } from "@/components/journal/DaySparkline";
import { MissedTradeForm } from "@/components/strategies/MissedTradeForm";
import { MissedTradeList } from "@/components/strategies/MissedTradeList";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateIST, istDateKey } from "@/lib/format";
import { rDistribution } from "@/lib/playbook";
import { computeStats, type StatTrade } from "@/lib/stats";
import { parseRules } from "@/lib/strategies";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Strategies" };

export default async function StrategiesPage() {
  const user = await getCurrentUser();
  const [strategies, trades, missed] = await Promise.all([
    db.strategy.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.trade.findMany({
      where: { userId: user.id },
      select: { strategyId: true, entryAt: true, exitAt: true, netPnl: true, grossPnl: true, totalCharges: true, rMultiple: true, points: true, underlying: true },
      orderBy: { exitAt: "asc" },
    }),
    db.missedTrade.findMany({
      where: { userId: user.id },
      include: { strategy: { select: { name: true, color: true } } },
      orderBy: { date: "desc" },
      take: 20,
    }),
  ]);

  const byStrategy = new Map<string, StatTrade[]>();
  for (const t of trades) {
    const k = t.strategyId ?? "none";
    byStrategy.set(k, [...(byStrategy.get(k) ?? []), t]);
  }
  const cards = [
    ...strategies.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      color: s.color,
      ruleCount: parseRules(s.entryRules).length + parseRules(s.exitRules).length + parseRules(s.riskRules).length,
      trades: byStrategy.get(s.id) ?? [],
    })),
    { id: null, name: "No strategy", description: "Trades you took without a playbook.", color: "#8a94a6", ruleCount: 0, trades: byStrategy.get("none") ?? [] },
  ];

  return (
    <>
      <PageHeader
        title="Strategies"
        description="Your playbooks: the rules you trade by, and how each one actually performs."
        actions={<Link href="/strategies/new" className="btn-primary"><Plus size={16} /> New strategy</Link>}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const s = computeStats(c.trades, { capital: user.profile?.capital });
          const r = rDistribution(c.trades.map((t) => t.rMultiple));
          const body = (
            <>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                  <h2 className="font-medium">{c.name}</h2>
                </div>
                <DaySparkline values={c.trades.map((t) => t.netPnl)} width={96} height={28} />
              </div>
              <p className="mb-4 line-clamp-2 min-h-8 text-xs text-muted">{c.description || "No description."}</p>
              {c.trades.length === 0 ? (
                <p className="text-sm text-muted">No trades yet.</p>
              ) : (
                <dl className="tabular grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-xs text-muted">Net P&amp;L</dt><dd><Money value={s.net} pnl className="font-medium" /></dd></div>
                  <div><dt className="text-xs text-muted">Win rate</dt><dd>{s.winRate.toFixed(0)}%</dd></div>
                  <div><dt className="text-xs text-muted">Profit factor</dt><dd>{s.profitFactor == null ? "∞" : s.profitFactor.toFixed(2)}</dd></div>
                  <div><dt className="text-xs text-muted">Trades</dt><dd>{s.count}</dd></div>
                  <div><dt className="text-xs text-muted">Per trade</dt><dd><Money value={s.expectancy} pnl /></dd></div>
                  <div><dt className="text-xs text-muted">Avg R</dt><dd>{r.avgR != null ? `${r.avgR >= 0 ? "+" : ""}${r.avgR.toFixed(2)}R` : "—"}</dd></div>
                </dl>
              )}
              {c.id && <p className="mt-3 text-xs text-muted">{c.ruleCount} rules · last traded {c.trades.length ? formatDateIST(c.trades[c.trades.length - 1].exitAt) : "never"}</p>}
            </>
          );
          return c.id ? (
            <Link key={c.id} href={`/strategies/${c.id}`} className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent">
              {body}
            </Link>
          ) : (
            <div key="none" className="rounded-xl border border-dashed border-border bg-surface p-4">{body}</div>
          );
        })}
      </div>

      <Card title="Missed trades: setups you saw but didn't take">
        <p className="mb-4 text-xs text-muted">
          Logging these shows whether hesitation is costing you more than bad trades. Be honest: only log setups that matched your rules.
        </p>
        <MissedTradeForm strategies={strategies.map((s) => ({ id: s.id, name: s.name }))} today={istDateKey(new Date())} />
        <div className="mt-6">
          <MissedTradeList items={missed} />
        </div>
      </Card>
    </>
  );
}
