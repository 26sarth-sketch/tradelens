import { Trash2 } from "lucide-react";
import { deleteMissedTrade } from "@/app/(app)/strategies/actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Money } from "@/components/ui/Money";
import { formatDateIST } from "@/lib/format";

type Missed = { id: string; date: Date; symbol: string; reason: string; hypotheticalPnl: number | null; strategy: { name: string; color: string } | null };

export function MissedTradeList({ items, showStrategy = true }: { items: Missed[]; showStrategy?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-muted">No missed trades logged.</p>;
  const total = items.reduce((s, m) => s + (m.hypotheticalPnl ?? 0), 0);
  return (
    <div>
      <ul className="divide-y divide-border text-sm">
        {items.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">{formatDateIST(m.date)}</span>
                <span className="font-medium">{m.symbol}</span>
                {showStrategy && m.strategy && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: m.strategy.color }} aria-hidden /> {m.strategy.name}
                  </span>
                )}
              </div>
              {m.reason && <p className="truncate text-xs text-muted">{m.reason}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {m.hypotheticalPnl != null && <Money value={m.hypotheticalPnl} pnl />}
              <form action={deleteMissedTrade}>
                <input type="hidden" name="id" value={m.id} />
                <ConfirmButton message="Delete this missed trade?" className="p-1 text-muted hover:text-loss">
                  <Trash2 size={14} />
                </ConfirmButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {total !== 0 && (
        <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
          Left on the table by not taking these setups: <Money value={total} className="font-medium text-warn" />
        </p>
      )}
    </div>
  );
}
