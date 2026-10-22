"use client";

import { Calculator, Loader2, RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { recomputeCharges, resetDemoData, type SettingsState } from "@/app/(app)/settings/actions";

export function DataActions() {
  const [rState, recompute, recomputing] = useActionState<SettingsState>(recomputeCharges, {});
  const [dState, reset, resetting] = useActionState<SettingsState>(resetDemoData, {});
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form action={recompute}>
          <button className="btn-ghost" disabled={recomputing}>
            {recomputing ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Recalculate charges on all trades
          </button>
        </form>
        <span className="text-xs text-muted">{rState.message ?? rState.error ?? "Use after updating rates in config/market.ts."}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form
          action={reset}
          onSubmit={(e) => {
            if (!window.confirm("Delete ALL your data and reload the demo journal? This can't be undone.")) e.preventDefault();
          }}
        >
          <button className="btn-ghost text-loss" disabled={resetting}>
            {resetting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Reset to demo data
          </button>
        </form>
        <span className="text-xs text-muted">{dState.message ?? dState.error ?? "Wipes everything and reloads ~60 days of demo trades."}</span>
      </div>
    </div>
  );
}
