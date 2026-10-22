import clsx from "clsx";
import type { rDistribution } from "@/lib/playbook";

/**
 * R-multiple histogram as plain HTML columns: count on each cap, bucket label
 * below, red for losing buckets and green for winning ones, with a native
 * tooltip per column. Counts are printed, so colour is never the only cue.
 */
export function RHistogram({ dist }: { dist: ReturnType<typeof rDistribution> }) {
  const max = Math.max(1, ...dist.buckets.map((b) => b.count));
  if (dist.withR === 0) {
    return <p className="py-8 text-center text-sm text-muted">No trades with a stop-loss yet, so there&apos;s no R to show.</p>;
  }
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label="R-multiple distribution">
        {dist.buckets.map((b) => (
          <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end" title={`${b.label}: ${b.count} trade${b.count === 1 ? "" : "s"}`}>
            <span className="tabular mb-1 text-xs text-muted">{b.count || ""}</span>
            <div
              className={clsx("w-full max-w-12 rounded-t", b.max <= 0 ? "bg-loss" : "bg-profit", b.count === 0 && "opacity-0")}
              style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 border-t border-border pt-1">
        {dist.buckets.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[10px] leading-tight text-muted">{b.label}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {dist.withR} trades with a stop-loss · average {dist.avgR != null ? `${dist.avgR >= 0 ? "+" : ""}${dist.avgR.toFixed(2)}R` : "—"}
        {dist.withoutR > 0 && ` · ${dist.withoutR} without a stop-loss not shown`}
      </p>
    </div>
  );
}
