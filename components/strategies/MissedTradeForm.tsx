"use client";

import { Check, Loader2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { addMissedTrade, type MissedState } from "@/app/(app)/strategies/actions";

/** Log a setup that matched a strategy but wasn't taken. */
export function MissedTradeForm({
  strategies,
  defaultStrategyId,
  today,
}: {
  strategies: { id: string; name: string }[];
  defaultStrategyId?: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<MissedState, FormData>(addMissedTrade, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after each successful save (DOM reset, not React state).
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.savedAt]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await action(fd);
        });
      }}
      className="@container grid grid-cols-2 gap-3"
    >
      <div className="col-span-2 grid grid-cols-2 gap-3 @2xl:grid-cols-6">
      <label className="col-span-1">
        <span className="label">Date</span>
        <input type="date" name="date" defaultValue={today} className="input" required />
      </label>
      <label className="col-span-1 @2xl:col-span-2">
        <span className="label">Strategy</span>
        <select name="strategyId" defaultValue={defaultStrategyId ?? ""} className="input">
          <option value="">No strategy</option>
          {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Symbol</span>
        <input name="symbol" placeholder="NIFTY" className="input uppercase" required maxLength={40} />
      </label>
      <label>
        <span className="label">Would have made (₹)</span>
        <input name="hypotheticalPnl" type="number" step="any" inputMode="decimal" placeholder="optional" className="input" />
      </label>
      <label className="col-span-2 @2xl:col-span-6">
        <span className="label">Why didn&apos;t you take it?</span>
        <input name="reason" maxLength={300} placeholder="e.g. Hesitated after the previous loss" className="input" />
      </label>
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Log missed trade"}
        </button>
        {state.ok && !pending && <span className="flex items-center gap-1 text-sm text-profit"><Check size={14} /> Logged</span>}
        {state.error && <span className="text-sm text-loss">{state.error}</span>}
      </div>
    </form>
  );
}
