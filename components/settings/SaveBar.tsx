import { Check, Loader2 } from "lucide-react";
import type { SettingsState } from "@/app/(app)/settings/actions";

export function SaveBar({ pending, state, label = "Save" }: { pending: boolean; state: SettingsState; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary" disabled={pending}>
        {pending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : label}
      </button>
      {state.ok && !pending && <span className="flex items-center gap-1 text-sm text-profit"><Check size={14} /> {state.message}</span>}
      {state.error && <span className="text-sm text-loss">{state.error}</span>}
    </div>
  );
}
