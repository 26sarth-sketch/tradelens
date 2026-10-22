"use client";

import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { type NotebookState, savePlan } from "@/app/(app)/notebook/actions";
import { EMOTIONS, type Emotion } from "@/lib/types";

export function PlanForm({
  date,
  initial,
  strategies,
}: {
  date: string;
  initial: { planMaxTrades: number | null; planMaxLoss: number | null; planStrategyIds: string[]; planMood: string | null; planNotes: string };
  strategies: { id: string; name: string; color: string }[];
}) {
  const [state, action, pending] = useActionState<NotebookState, FormData>(savePlan.bind(null, date), {});
  const [ids, setIds] = useState<string[]>(initial.planStrategyIds);
  const [mood, setMood] = useState<Emotion | null>(initial.planMood as Emotion | null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("planStrategyIds", JSON.stringify(ids));
        fd.set("planMood", mood ?? "");
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Max trades today</span>
          <input name="planMaxTrades" type="number" min="1" step="1" inputMode="numeric" defaultValue={initial.planMaxTrades ?? ""} className="input" />
        </label>
        <label>
          <span className="label">Max loss today (₹)</span>
          <input name="planMaxLoss" type="number" min="1" step="any" inputMode="decimal" defaultValue={initial.planMaxLoss ?? ""} className="input" />
        </label>
      </div>
      <div>
        <span className="label">Strategies I&apos;ll trade</span>
        <div className="flex flex-wrap gap-1.5">
          {strategies.map((s) => {
            const on = ids.includes(s.id);
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => setIds(on ? ids.filter((x) => x !== s.id) : [...ids, s.id])}
                className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", on ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg")}>
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden /> {s.name}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="label">How am I feeling?</span>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONS.map((e) => (
            <button key={e} type="button" aria-pressed={mood === e} onClick={() => setMood(mood === e ? null : e)}
              className={clsx("rounded-full border px-3 py-1 text-sm", mood === e ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg")}>
              {e}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">Plan notes: levels to watch, news, what I will NOT do</span>
        <textarea name="planNotes" rows={4} defaultValue={initial.planNotes} className="input" placeholder="e.g. Only ORB before 10:30. No trades after 2 PM. Stop after 2 losses." />
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save plan"}</button>
        {state.ok && !pending && <span className="flex items-center gap-1 text-sm text-profit"><Check size={14} /> Plan saved</span>}
        {state.error && <span className="text-sm text-loss">{state.error}</span>}
      </div>
    </form>
  );
}
