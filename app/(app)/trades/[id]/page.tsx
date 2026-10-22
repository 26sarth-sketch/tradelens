import clsx from "clsx";
import { ArrowLeft, Check, CheckCircle2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportCard } from "@/components/coach/ReportCard";
import { TradeReviewForm } from "@/components/trades/TradeReviewForm";
import { aiConfig } from "@/lib/ai/client";
import { getCachedReport } from "@/lib/ai/coach";
import { Card, Stat } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Money } from "@/components/ui/Money";
import { chargesPctOfGross } from "@/lib/charges";
import { db } from "@/lib/db";
import { formatDateIST, formatDateTimeIST, formatNumber, formatTimeIST, pnlClass } from "@/lib/format";
import { isIndex } from "@/lib/expiry";
import { SEGMENT_LABELS, type Segment } from "@/lib/types";
import { parseIdList, parseRules } from "@/lib/strategies";
import { excursions } from "@/lib/trades";
import { getCurrentUser } from "@/lib/user";
import { deleteTrade } from "../actions";
import { decideSuggestion } from "../tags/actions";

export const metadata = { title: "Trade" };

function duration(from: Date, to: Date) {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.round(mins / (60 * 24))} days`;
}

export default async function TradeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const t = await db.trade.findFirst({
    where: { id, userId: user.id },
    include: { strategy: true, tags: { include: { tag: true } }, ruleChecks: true },
  });
  if (!t) notFound();
  const [strategies, allTags] = await Promise.all([
    db.strategy.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const exc = excursions(t);

  const charges = [
    { label: "Brokerage", value: t.brokerage },
    { label: "STT", value: t.stt },
    { label: "Exchange txn charges", value: t.exchangeTxn },
    { label: "SEBI fee", value: t.sebiFee },
    { label: "Stamp duty", value: t.stampDuty },
    { label: "GST (18%)", value: t.gst },
    ...(t.otherCharges ? [{ label: "DP charge", value: t.otherCharges }] : []),
  ];
  const pct = chargesPctOfGross(t.totalCharges, t.grossPnl);
  const pointsLabel = isIndex(t.underlying) && t.segment !== "OPT" ? "Index points" : "Points per unit";

  return (
    <>
      <Link href="/trades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Trade Log
      </Link>

      {sp.created && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-profit/30 bg-profit/10 px-3 py-2 text-sm text-profit">
          <CheckCircle2 size={16} /> Trade saved.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t.symbol}</h1>
            <span className={clsx("rounded px-2 py-0.5 text-xs", t.direction === "LONG" ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss")}>
              {t.direction === "LONG" ? "Long" : "Short"}
            </span>
            <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">{SEGMENT_LABELS[t.segment as Segment]} · {t.exchange}</span>
            {t.isExpiryDay && <span className="rounded bg-warn/15 px-2 py-0.5 text-xs text-warn">Expiry day</span>}
          </div>
          <p className="mt-1 text-sm text-muted">{formatDateIST(t.entryAt)} · {formatTimeIST(t.entryAt)} → {formatTimeIST(t.exitAt)} IST</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted">Net P&amp;L</div>
          <Money value={t.netPnl} pnl decimals className="text-3xl font-semibold" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Execution" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Quantity" hint={t.lots ? `${formatNumber(t.lots, t.lots % 1 ? 2 : 0)} lot × ${t.lotSize}` : undefined}>
              <span className="tabular">{formatNumber(t.qty)}</span>
            </Stat>
            <Stat label="Entry"><span className="tabular">{formatNumber(t.avgEntry, 2)}</span></Stat>
            <Stat label="Exit"><span className="tabular">{formatNumber(t.avgExit, 2)}</span></Stat>
            <Stat label={pointsLabel}>
              <span className={clsx("tabular", pnlClass(t.points ?? 0))}>{(t.points ?? 0) > 0 ? "+" : ""}{formatNumber(t.points ?? 0, 2)}</span>
            </Stat>
            <Stat label="Entry time"><span className="tabular">{formatDateTimeIST(t.entryAt)}</span></Stat>
            <Stat label="Exit time"><span className="tabular">{formatDateTimeIST(t.exitAt)}</span></Stat>
            <Stat label="Held for">{duration(t.entryAt, t.exitAt)}</Stat>
            {t.expiry && <Stat label="Contract expiry">{formatDateIST(t.expiry)}</Stat>}
          </div>
        </Card>

        <Card title="Gross → Net" className="lg:row-span-2">
          <dl className="tabular space-y-1.5 text-sm">
            <div className="flex justify-between"><dt>Gross P&amp;L</dt><dd><Money value={t.grossPnl} pnl decimals /></dd></div>
            {charges.map((c) => (
              <div key={c.label} className="flex justify-between text-muted">
                <dt>{c.label}</dt>
                <dd><Money value={c.value} decimals /></dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-1.5 text-warn">
              <dt>Total charges</dt><dd><Money value={-t.totalCharges} decimals /></dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Net P&amp;L</dt><dd><Money value={t.netPnl} pnl decimals /></dd>
            </div>
          </dl>
          {pct != null ? (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Charges as % of gross profit</span>
                <span className="font-medium text-warn">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-warn" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted">This trade lost money before charges; charges made the loss bigger.</p>
          )}
        </Card>

        {(exc || t.rMultiple != null) && (
          <Card title="Result vs plan" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="R-multiple" hint="Net P&L ÷ ₹ risked">
                {t.rMultiple != null ? <span className={pnlClass(t.rMultiple)}>{t.rMultiple.toFixed(2)}R</span> : "—"}
              </Stat>
              <Stat label="Planned R:R">{t.plannedR != null ? `1 : ${t.plannedR.toFixed(2)}` : "—"}</Stat>
              {exc && (
                <>
                  <Stat label="Best open profit"><Money value={exc.mfe} className="text-profit" /></Stat>
                  <Stat label="Left on table" hint={exc.capturedPct == null ? undefined : exc.capturedPct < 0 ? "Was in profit before it reversed" : `Captured ${exc.capturedPct}% of the move`}>
                    <Money value={exc.leftOnTable} className="text-warn" />
                  </Stat>
                </>
              )}
            </div>
          </Card>
        )}

        {t.tags.some((x) => !x.accepted && !x.dismissed) && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 lg:col-span-3">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-accent" /> Auto-tagger suggestions</h2>
            <ul className="space-y-2">
              {t.tags.filter((x) => !x.accepted && !x.dismissed).map((x) => (
                <li key={x.tagId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 font-medium">{x.tag.name}</span>
                    {x.reason && <span className="ml-2 text-xs text-muted">{x.reason}</span>}
                  </span>
                  <span className="flex gap-1.5">
                    <form action={decideSuggestion}>
                      <input type="hidden" name="tradeId" value={t.id} />
                      <input type="hidden" name="tagId" value={x.tagId} />
                      <input type="hidden" name="decision" value="accept" />
                      <button className="btn-ghost py-1 text-xs text-profit"><Check size={14} /> Accept</button>
                    </form>
                    <form action={decideSuggestion}>
                      <input type="hidden" name="tradeId" value={t.id} />
                      <input type="hidden" name="tagId" value={x.tagId} />
                      <input type="hidden" name="decision" value="dismiss" />
                      <button className="btn-ghost py-1 text-xs text-muted"><X size={14} /> Dismiss</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="lg:col-span-3">
          <ReportCard
            type="TRADE"
            reportKey={t.id}
            initial={await getCachedReport(user.id, "TRADE", t.id)}
            aiEnabled={aiConfig().enabled}
            title="Coach feedback"
            subtitle="Judges your process (plan, stop-loss, sizing, timing, emotion), not whether the trade made money."
          />
        </div>

        <Card title="Review this trade" className="lg:col-span-3">
          <TradeReviewForm
            tradeId={t.id}
            trade={{ direction: t.direction, qty: t.qty, avgEntry: t.avgEntry, avgExit: t.avgExit, netPnl: t.netPnl }}
            strategies={strategies.map((s) => ({
              id: s.id,
              name: s.name,
              entryRules: parseRules(s.entryRules),
              exitRules: parseRules(s.exitRules),
              riskRules: parseRules(s.riskRules),
            }))}
            allTags={allTags.map((x) => x.name)}
            initial={{
              strategyId: t.strategyId,
              checkedRules: parseIdList(t.ruleChecks.find((c) => c.strategyId === t.strategyId)?.checkedRules),
              tags: t.tags.filter((x) => x.accepted).map((x) => x.tag.name),
              emotionBefore: t.emotionBefore,
              emotionAfter: t.emotionAfter,
              followedPlan: t.followedPlan,
              plannedSL: t.plannedSL,
              plannedTarget: t.plannedTarget,
              highPrice: t.highPrice,
              lowPrice: t.lowPrice,
              notes: t.notes,
              screenshotUrl: t.screenshot ? `/api/uploads/${t.screenshot}` : null,
            }}
          />
        </Card>

        <form action={deleteTrade} className="lg:col-start-3">
          <input type="hidden" name="id" value={t.id} />
          <ConfirmButton message="Delete this trade permanently?" className="btn-ghost w-full text-loss">
            <Trash2 size={16} /> Delete trade
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
