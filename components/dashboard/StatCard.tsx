import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";

export function StatCard({
  label,
  value,
  sub,
  info,
  learnHref,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  info?: ReactNode;
  learnHref?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
        {label}
        {info && <InfoTip learnHref={learnHref}>{info}</InfoTip>}
      </div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
