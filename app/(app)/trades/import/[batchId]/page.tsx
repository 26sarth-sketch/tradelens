import { CheckCircle2, Sparkles, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Money } from "@/components/ui/Money";
import { chargesPctOfGross } from "@/lib/charges";
import { db } from "@/lib/db";
import { formatDateIST, formatDateTimeIST, formatTimeIST } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";
import { deleteBatch } from "../actions";

export const metadata = { title: "Import summary" };

export default async function ImportSummaryPage({ params }: { params: Promise<{ batchId: string }> }) {
  const [{ batchId }, user] = await Promise.all([params, getCurrentUser()]);
  const batch = await db.importBatch.findFirst({
    where: { id: batchId, userId: user.id },
    include: { trades: { orderBy: { entryAt: "asc" } } },
  });
  if (!batch) notFound();

  const t = batch.trades;
  const gross = t.reduce((s, x) => s + x.grossPnl, 0);
  const charges = t.reduce((s, x) => s + x.totalCharges, 0);
  const net = t.reduce((s, x) => s + x.netPnl, 0);
  const wins = t.filter((x) => x.netPnl > 0).length;
  const pct = chargesPctOfGross(charges, gross);

  return (
    <>
      <div className="mb-6 flex items-start gap-3">
        <CheckCircle2 className="mt-1 text-profit" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Imported {t.length} trades</h1>
          <p className="text-sm text-muted">{batch.filename} · {formatDateTimeIST(batch.createdAt)}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-muted">Win rate</div><div className="tabular text-lg font-medium">{t.length ? ((wins / t.length) * 100).toFixed(0) : 0}%</div></Card>
        <Card><div className="text-xs text-muted">Gross P&amp;L</div><Money value={gross} pnl className="text-lg font-medium" /></Card>
        <Card>
          <div className="text-xs text-muted">Charges</div>
          <Money value={charges} className="text-lg font-medium text-warn" />
          {pct != null && <div className="text-xs text-muted">{pct.toFixed(0)}% of gross profit</div>}
        </Card>
        <Card><div className="text-xs text-muted">Net P&amp;L</div><Money value={net} pnl className="text-lg font-medium" /></Card>
      </div>

      <Card className="mb-4 border-accent/40" title={<span className="flex items-center gap-2 text-fg"><Sparkles size={16} className="text-accent" /> What your data says</span>}>
        <p className="text-sm text-muted">The AI Coach&apos;s first-import analysis appears here once it&apos;s built (Day 2, step 12).</p>
      </Card>

      <Card title="Trades in this import">
        <ul className="divide-y divide-border text-sm">
          {t.map((x) => (
            <li key={x.id}>
              <Link href={`/trades/${x.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-accent">
                <span className="truncate">
                  <span className="text-muted">{formatDateIST(x.entryAt)} {formatTimeIST(x.entryAt)}</span>{" "}
                  <span className="font-medium">{x.symbol}</span>
                </span>
                <Money value={x.netPnl} pnl decimals />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/trades" className="btn-primary">Go to Trade Log</Link>
        <form action={deleteBatch}>
          <input type="hidden" name="id" value={batch.id} />
          <ConfirmButton message={`Remove all ${t.length} trades from this import?`} className="btn-ghost text-loss">
            <Undo2 size={16} /> Undo import
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
