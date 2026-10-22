import clsx from "clsx";
import { formatINR, formatINRCompact, pnlClass } from "@/lib/format";

/**
 * Every ₹ amount renders through this, so privacy mode can blur them all with one
 * CSS rule (`.money` under `[data-privacy]`, added in the dashboard step).
 */
export function Money({
  value,
  pnl = false,
  signed = false,
  decimals = false,
  compact = false,
  className,
}: {
  value: number;
  /** Colour green/red by sign. */
  pnl?: boolean;
  signed?: boolean;
  decimals?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx("money tabular whitespace-nowrap", pnl && pnlClass(value), className)}>
      {compact ? formatINRCompact(value) : formatINR(value, { signed: signed || pnl, decimals })}
    </span>
  );
}
