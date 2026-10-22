import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { GenericImport } from "@/components/trades/import/GenericImport";
import { ZerodhaImport } from "@/components/trades/import/ZerodhaImport";
import { PageHeader } from "@/components/ui/PageHeader";
import { db } from "@/lib/db";
import { formatDateTimeIST } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Import trades" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ undone?: string; broker?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const generic = sp.broker === "other";
  const batches = await db.importBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <>
      <PageHeader
        title="Import trades"
        description="Bring in your broker's tradebook. Fills become complete trades with Indian charges."
        actions={<Link href="/trades/new" className="btn-ghost">Add manually</Link>}
      />

      {sp.undone && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          <CheckCircle2 size={16} /> Import undone. Those trades were removed.
        </div>
      )}

      <nav className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm sm:w-fit">
        {[
          { href: "/trades/import", label: "Zerodha", active: !generic },
          { href: "/trades/import?broker=other", label: "Upstox, Angel One, Groww, Dhan & others", active: generic },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={clsx("rounded-md px-3 py-1.5", t.active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {generic ? <GenericImport /> : <ZerodhaImport />}

      {batches.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-muted">Recent imports</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
            {batches.map((b) => (
              <li key={b.id}>
                <Link href={`/trades/import/${b.id}`} className="flex justify-between gap-4 px-3 py-2.5 hover:bg-surface-2">
                  <span className="truncate">{b.filename ?? b.source}</span>
                  <span className="shrink-0 text-muted">{b.tradeCount} trades · {formatDateTimeIST(b.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
