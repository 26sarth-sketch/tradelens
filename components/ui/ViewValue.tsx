import clsx from "clsx";
import { formatNumber, pnlClass } from "@/lib/format";
import type { View } from "@/lib/stats";
import { Money } from "./Money";

/** Formats a value in the dashboard's current unit. ₹ goes through <Money> (privacy-aware). */
export function formatView(view: View, v: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const sign = opts.signed && v > 0 ? "+" : "";
  switch (view) {
    case "pct":
      return `${sign}${v.toFixed(2)}%`;
    case "r":
      return `${sign}${v.toFixed(2)}R`;
    case "points":
      return `${sign}${formatNumber(v, Math.abs(v) >= 100 || opts.compact ? 0 : 1)} pts`;
    case "inr":
      return `${sign}₹${formatNumber(Math.round(v))}`;
  }
}

export function ViewValue({
  view,
  value,
  pnl = false,
  signed = false,
  compact = false,
  className,
}: {
  view: View;
  value: number;
  pnl?: boolean;
  signed?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (view === "inr") return <Money value={value} pnl={pnl} signed={signed} compact={compact} className={className} />;
  return (
    <span className={clsx("tabular whitespace-nowrap", pnl && pnlClass(value), className)}>
      {formatView(view, value, { signed: signed || pnl, compact })}
    </span>
  );
}
