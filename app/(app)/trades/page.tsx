import type { Prisma } from "@prisma/client";
import clsx from "clsx";
import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateIST, formatNumber, formatTimeIST, fromIST } from "@/lib/format";
import { SEGMENT_LABELS, SEGMENTS, type Segment } from "@/lib/types";
import { pendingSuggestionCount } from "@/lib/autotag-store";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Trade Log" };

const PAGE_SIZE = 100;

type Search = { from?: string; to?: string; segment?: string; q?: string; result?: string; page?: string };

export default async function TradeLogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  const where: Prisma.TradeWhereInput = { userId: user.id };
  if (sp.from || sp.to) {
    where.entryAt = {
      ...(sp.from ? { gte: fromIST(sp.from, "00:00") } : {}),
      ...(sp.to ? { lte: fromIST(sp.to, "23:59") } : {}),
    };
  }
  if (sp.segment && (SEGMENTS as readonly string[]).includes(sp.segment)) where.segment = sp.segment;
  if (sp.q) where.symbol = { contains: sp.q.trim().toUpperCase() };
  if (sp.result === "win") where.netPnl = { gt: 0 };
  if (sp.result === "loss") where.netPnl = { lte: 0 };

  const page = Math.max(1, Number(sp.page) || 1);
  const [trades, totals, wins] = await Promise.all([
    db.trade.findMany({
      where,
      orderBy: { entryAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { strategy: { select: { name: true } } },
    }),
    db.trade.aggregate({ where, _count: true, _sum: { grossPnl: true, totalCharges: true, netPnl: true } }),
    db.trade.count({ where: { ...where, netPnl: { gt: 0 } } }),
  ]);
  const count = totals._count;
  const pendingTags = await pendingSuggestionCount(user.id);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const hasFilters = Boolean(sp.from || sp.to || sp.segment || sp.q || sp.result);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    params.set("page", String(p));
    return `/trades?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Trade Log"
        description="Every round trip, after Indian charges."
        actions={
          <>
            <Link href="/trades/tags" className="btn-ghost">
              <Sparkles size={16} className="text-accent" /> Auto-tag{pendingTags > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">{pendingTags}</span>}
            </Link>
            <Link href="/trades/new" className="btn-primary">
              <Plus size={16} /> Add trade
            </Link>
          </>
        }
      />

      {/* Plain GET form: filters live in the URL, so they're shareable and work without JS. */}
      <form className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
        <label>
          <span className="label">From</span>
          <input type="date" name="from" defaultValue={sp.from} className="input" />
        </label>
        <label>
          <span className="label">To</span>
          <input type="date" name="to" defaultValue={sp.to} className="input" />
        </label>
        <label>
          <span className="label">Segment</span>
          <select name="segment" defaultValue={sp.segment ?? ""} className="input">
            <option value="">All</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Symbol</span>
          <input name="q" defaultValue={sp.q} placeholder="NIFTY" className="input uppercase" />
        </label>
        <label>
          <span className="label">Result</span>
          <select name="result" defaultValue={sp.result ?? ""} className="input">
            <option value="">All</option>
            <option value="win">Winners</option>
            <option value="loss">Losers</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-primary flex-1">Apply</button>
          {hasFilters && <Link href="/trades" className="btn-ghost">Clear</Link>}
        </div>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Summary label="Trades">{formatNumber(count)}</Summary>
        <Summary label="Win rate">{count ? `${((wins / count) * 100).toFixed(1)}%` : "—"}</Summary>
        <Summary label="Gross P&L"><Money value={totals._sum.grossPnl ?? 0} pnl /></Summary>
        <Summary label="Charges"><Money value={totals._sum.totalCharges ?? 0} className="text-warn" /></Summary>
        <Summary label="Net P&L"><Money value={totals._sum.netPnl ?? 0} pnl /></Summary>
      </div>

      {trades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          {hasFilters ? "No trades match these filters." : (
            <>No trades yet. <Link href="/trades/new" className="text-accent underline">Add your first trade</Link>.</>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="tabular w-full min-w-[900px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Symbol</th>
                <th className="px-3 py-2.5 font-medium">Segment</th>
                <th className="px-3 py-2.5 font-medium">Side</th>
                <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                <th className="px-3 py-2.5 text-right font-medium">Entry → Exit</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                <th className="px-3 py-2.5 text-right font-medium">Charges</th>
                <th className="px-3 py-2.5 text-right font-medium">Net</th>
                <th className="px-3 py-2.5 text-right font-medium">R</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="relative border-b border-border/60 last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link href={`/trades/${t.id}`} className="after:absolute after:inset-0">
                      {formatDateIST(t.entryAt)}
                    </Link>
                    <span className="ml-2 text-xs text-muted">{formatTimeIST(t.entryAt)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                    {t.symbol}
                    {t.isExpiryDay && <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">EXPIRY</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted">{SEGMENT_LABELS[t.segment as Segment]}</td>
                  <td className={clsx("px-3 py-2.5", t.direction === "LONG" ? "text-profit" : "text-loss")}>
                    {t.direction === "LONG" ? "Long" : "Short"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatNumber(t.qty)}
                    {t.lots ? <span className="block text-xs text-muted">{formatNumber(t.lots, t.lots % 1 ? 2 : 0)} lot</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted">
                    {formatNumber(t.avgEntry, 2)} → {formatNumber(t.avgExit, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Money value={t.grossPnl} pnl /></td>
                  <td className="px-3 py-2.5 text-right text-warn"><Money value={t.totalCharges} /></td>
                  <td className="px-3 py-2.5 text-right font-medium"><Money value={t.netPnl} pnl /></td>
                  <td className="px-3 py-2.5 text-right text-muted">{t.rMultiple != null ? `${t.rMultiple.toFixed(2)}R` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-ghost">Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="btn-ghost">Next</Link>}
        </div>
      )}
    </>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 text-base font-medium">{children}</div>
    </div>
  );
}
