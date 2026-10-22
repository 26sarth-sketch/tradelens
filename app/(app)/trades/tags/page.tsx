import { ArrowLeft, Check, ScanSearch, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateIST, formatTimeIST } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";
import { decideAll, decideSuggestion, scanForTags } from "./actions";
import { MoneyText } from "@/components/ui/MoneyText";

export const metadata = { title: "Auto-tag review" };

export default async function TagReviewPage({ searchParams }: { searchParams: Promise<{ found?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const pending = await db.tradeTag.findMany({
    where: { accepted: false, dismissed: false, trade: { userId: user.id } },
    include: { tag: true, trade: { select: { id: true, symbol: true, entryAt: true, netPnl: true } } },
    orderBy: { trade: { entryAt: "desc" } },
  });
  const groups = new Map<string, { tagId: string; name: string; items: typeof pending }>();
  for (const p of pending) {
    const g = groups.get(p.tagId) ?? { tagId: p.tagId, name: p.tag.name, items: [] };
    g.items.push(p);
    groups.set(p.tagId, g);
  }

  return (
    <>
      <Link href="/trades" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Trade Log
      </Link>
      <PageHeader
        title="Auto-tag review"
        description="The auto-tagger checks every trade for revenge trades, overtrading, losers held too long and trades after your cut-off. Accept what's true; dismiss the rest."
        actions={
          <form action={scanForTags}>
            <button className="btn-primary"><ScanSearch size={16} /> Scan my trades</button>
          </form>
        }
      />

      {sp.found != null && (
        <p className="mb-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Scan complete: {Number(sp.found) || "no"} new suggestion{Number(sp.found) === 1 ? "" : "s"}.
        </p>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          No suggestions waiting. Click <span className="text-fg">Scan my trades</span> to check your journal.
        </div>
      ) : (
        <div className="space-y-4">
          {[...groups.values()].map((g) => (
            <section key={g.tagId} className="rounded-xl border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="flex items-center gap-2 font-medium">
                  <Sparkles size={16} className="text-accent" /> {g.name}
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{g.items.length}</span>
                  <span className="text-xs font-normal text-muted">
                    total <Money value={g.items.reduce((s, x) => s + x.trade.netPnl, 0)} pnl />
                  </span>
                </h2>
                <div className="flex gap-2">
                  <form action={decideAll}>
                    <input type="hidden" name="tagId" value={g.tagId} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="btn-ghost py-1 text-xs"><Check size={14} /> Accept all</button>
                  </form>
                  <form action={decideAll}>
                    <input type="hidden" name="tagId" value={g.tagId} />
                    <input type="hidden" name="decision" value="dismiss" />
                    <button className="btn-ghost py-1 text-xs text-muted"><X size={14} /> Dismiss all</button>
                  </form>
                </div>
              </header>
              <ul className="divide-y divide-border/60">
                {g.items.map((s) => (
                  <li key={`${s.tradeId}-${s.tagId}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <Link href={`/trades/${s.tradeId}`} className="min-w-0 flex-1 hover:text-accent">
                      <span className="text-muted">{formatDateIST(s.trade.entryAt)} {formatTimeIST(s.trade.entryAt)}</span>{" "}
                      <span className="font-medium">{s.trade.symbol}</span>{" "}
                      <Money value={s.trade.netPnl} pnl />
                      {s.reason && <span className="block text-xs text-muted"><MoneyText text={s.reason} /></span>}
                    </Link>
                    <div className="flex gap-1.5">
                      <form action={decideSuggestion}>
                        <input type="hidden" name="tradeId" value={s.tradeId} />
                        <input type="hidden" name="tagId" value={s.tagId} />
                        <input type="hidden" name="decision" value="accept" />
                        <button className="rounded-md border border-profit/40 px-2 py-1 text-xs text-profit hover:bg-profit/10" aria-label={`Accept ${g.name} on ${s.trade.symbol}`}><Check size={14} /></button>
                      </form>
                      <form action={decideSuggestion}>
                        <input type="hidden" name="tradeId" value={s.tradeId} />
                        <input type="hidden" name="tagId" value={s.tagId} />
                        <input type="hidden" name="decision" value="dismiss" />
                        <button className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:text-fg" aria-label={`Dismiss ${g.name} on ${s.trade.symbol}`}><X size={14} /></button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
