import clsx from "clsx";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ChargesCallout } from "@/components/dashboard/ChargesCallout";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { PnlCalendar } from "@/components/dashboard/PnlCalendar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { ViewValue } from "@/components/ui/ViewValue";
import { db } from "@/lib/db";
import { daysAgo, formatINR, istDateKey } from "@/lib/format";
import { computeStats, dailyStats, equityCurve, VIEW_LABELS, VIEWS, type View } from "@/lib/stats";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Dashboard" };

const RANGES = [
  { key: "30", label: "30D", days: 30 },
  { key: "60", label: "60D", days: 60 },
  { key: "all", label: "All", days: null },
] as const;

type Search = { view?: string; range?: string; month?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const view: View = (VIEWS as readonly string[]).includes(sp.view ?? "") ? (sp.view as View) : "inr";
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[2];
  const capital = user.profile?.capital ?? 0;

  const since = range.days ? daysAgo(range.days) : undefined;
  const trades = await db.trade.findMany({
    where: { userId: user.id, ...(since ? { exitAt: { gte: since } } : {}) },
    select: {
      entryAt: true, exitAt: true, netPnl: true, grossPnl: true, totalCharges: true,
      rMultiple: true, points: true, underlying: true,
    },
    orderBy: { exitAt: "asc" },
  });

  const href = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { view, range: range.key, month: sp.month, ...patch };
    if (merged.view && merged.view !== "inr") p.set("view", merged.view);
    if (merged.range && merged.range !== "all") p.set("range", merged.range);
    if (merged.month) p.set("month", merged.month);
    const q = p.toString();
    return q ? `/dashboard?${q}` : "/dashboard";
  };

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="mb-4 text-muted">No trades {range.days ? `in the last ${range.days} days` : "yet"}.</p>
          <Link href="/trades/import" className="btn-primary"><Plus size={16} /> Import or add trades</Link>
        </div>
      </>
    );
  }

  const s = computeStats(trades, { view, capital });
  const days = dailyStats(trades, { view, capital });
  const curve = equityCurve(days);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : istDateKey(trades[trades.length - 1].exitAt).slice(0, 7);

  const coverage =
    view === "r" ? `${s.count} of ${s.totalTrades} trades have a stop-loss (needed for R)` :
    view === "points" ? `${s.count} of ${s.totalTrades} trades are on an index (NIFTY, BANKNIFTY…)` :
    view === "pct" ? `of ${formatINR(capital)} capital` : undefined;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${s.totalTrades} trades · ${days.length} trading days${coverage ? ` · ${coverage}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Segmented items={RANGES.map((r) => ({ href: href({ range: r.key }), label: r.label, active: r.key === range.key }))} />
            <Segmented items={VIEWS.map((v) => ({ href: href({ view: v }), label: VIEW_LABELS[v], active: v === view }))} />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net P&L"
          value={<ViewValue view={view} value={s.net} pnl />}
          sub={<>Gross <Money value={s.grossPnl} /> · charges <Money value={s.totalCharges} /></>}
          info="Total profit after every charge (brokerage, STT, exchange fees, SEBI fee, stamp duty, GST)."
        />
        <StatCard
          label="Win rate"
          value={`${s.winRate.toFixed(1)}%`}
          sub={`${s.wins} wins · ${s.losses} losses`}
          info="Winning trades ÷ all trades. A trade wins if it made money after charges. Win rate alone means little without the size of wins vs losses."
        />
        <StatCard
          label="Profit factor"
          value={s.profitFactor == null ? "∞" : s.profitFactor.toFixed(2)}
          sub={s.profitFactor == null ? "No losing trades" : s.profitFactor >= 1 ? "Above 1 = profitable" : "Below 1 = losing money"}
          info="Total of all wins ÷ total of all losses. 1.5 means you make ₹1.50 for every ₹1 you lose. Above 1 is profitable."
          learnHref="/learn/profit-factor"
        />
        <StatCard
          label="Avg win vs avg loss"
          value={<span className="flex items-baseline gap-1.5 text-xl"><ViewValue view={view} value={s.avgWin} className="text-profit" /><span className="text-muted">/</span><ViewValue view={view} value={-s.avgLoss} className="text-loss" /></span>}
          sub={s.winLossRatio != null ? `Ratio ${s.winLossRatio.toFixed(2)} : 1` : undefined}
          info="Average winning trade vs average losing trade. If your average loss is bigger than your average win, you need a high win rate just to break even."
        />
        <StatCard
          label="Expectancy"
          value={<ViewValue view={view} value={s.expectancy} pnl />}
          sub="per trade, on average"
          info="What one trade is worth on average: (win rate × avg win) − (loss rate × avg loss). Positive means your process makes money over many trades."
          learnHref="/learn/r-multiple"
        />
        <StatCard
          label="Max drawdown"
          value={<ViewValue view={view} value={-s.maxDrawdown} className="text-loss" />}
          sub={s.maxDrawdownPct != null ? `${s.maxDrawdownPct.toFixed(1)}% from the account's peak` : "largest fall from a peak"}
          info="The biggest fall from a high point of your running P&L to a later low. It shows how much pain your trading puts you through."
        />
        <StatCard
          label="Total charges"
          value={<Money value={s.totalCharges} className="text-warn" />}
          sub={s.chargesPctOfGross != null ? `${s.chargesPctOfGross.toFixed(0)}% of gross profit` : "on a gross loss"}
          info="Everything you paid to brokers, exchanges and the government on these trades. Always shown in ₹."
          learnHref="/learn/why-charges-matter"
        />
        <StatCard
          label="Trades per day"
          value={(s.totalTrades / days.length).toFixed(1)}
          sub={`${days.filter((d) => d.value > 0).length} of ${days.length} days green`}
          info="Average number of trades on days you traded. More trades means more charges."
        />
      </div>

      <div className="mb-4">
        <ChargesCallout gross={s.grossPnl} charges={s.totalCharges} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Equity curve · ${VIEW_LABELS[view]}`}>
          <EquityCurve data={curve} view={view} />
        </Card>
        <Card title="P&L calendar">
          <PnlCalendar days={days} month={month} view={view} monthHref={(m) => href({ month: m })} />
        </Card>
      </div>
    </>
  );
}

function Segmented({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex rounded-lg border border-border bg-surface p-0.5 text-sm">
      {items.map((i) => (
        <Link
          key={i.href + i.label}
          href={i.href}
          scroll={false}
          className={clsx("rounded-md px-2.5 py-1", i.active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
