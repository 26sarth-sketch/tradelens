import { Money } from "@/components/ui/Money";
import { InfoTip } from "@/components/ui/InfoTip";

/** The "charges ate X% of your profit" moment. Always in ₹, whatever the view. */
export function ChargesCallout({ gross, charges }: { gross: number; charges: number }) {
  if (gross <= 0) {
    return (
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm">
        You paid <Money value={charges} className="font-semibold text-warn" /> in charges on top of a gross loss of{" "}
        <Money value={gross} className="font-semibold" />. Charges always make a losing period worse.
      </div>
    );
  }
  const pct = Math.min(100, (charges / gross) * 100);
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          Charges ate <span className="text-lg font-semibold text-warn">{pct.toFixed(0)}%</span> of your gross profit
          <InfoTip learnHref="/learn/why-charges-matter">
            Brokerage, STT, exchange charges, SEBI fee, stamp duty and GST, divided by gross profit (before charges).
            Frequent small F&amp;O trades are hit hardest because most charges are per order or on turnover.
          </InfoTip>
        </p>
        <span className="text-xs text-muted">
          Gross <Money value={gross} /> → you kept <Money value={gross - charges} />
        </span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        <div className="bar-grow rounded-l-full bg-profit" style={{ width: `${100 - pct}%` }} />
        <div className="bar-grow rounded-r-full bg-warn" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>Kept</span>
        <span>Charges <Money value={charges} /></span>
      </div>
    </div>
  );
}
