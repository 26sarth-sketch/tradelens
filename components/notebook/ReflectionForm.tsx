"use client";

import clsx from "clsx";
import { Check, Loader2, Star } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { type NotebookState, saveReflection } from "@/app/(app)/notebook/actions";

export function ReflectionForm({
  date,
  initial,
}: {
  date: string;
  initial: { eodWentWell: string; eodToImprove: string; eodRating: number | null };
}) {
  const [state, action, pending] = useActionState<NotebookState, FormData>(saveReflection.bind(null, date), {});
  const [rating, setRating] = useState<number | null>(initial.eodRating);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("eodRating", rating ? String(rating) : "");
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="label">What went well?</span>
          <textarea name="eodWentWell" rows={4} defaultValue={initial.eodWentWell} className="input" placeholder="Process wins count, even on a red day." />
        </label>
        <label className="block">
          <span className="label">What will I do differently tomorrow?</span>
          <textarea name="eodToImprove" rows={4} defaultValue={initial.eodToImprove} className="input" placeholder="One specific, checkable change." />
        </label>
      </div>
      <div>
        <span className="label">Rate your discipline today (not your P&amp;L)</span>
        <div className="flex gap-1" role="radiogroup" aria-label="Discipline rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} of 5`} onClick={() => setRating(rating === n ? null : n)}
              className="p-0.5">
              <Star size={22} className={clsx(rating != null && n <= rating ? "fill-warn text-warn" : "text-muted")} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save reflection"}</button>
        {state.ok && !pending && <span className="flex items-center gap-1 text-sm text-profit"><Check size={14} /> Saved</span>}
        {state.error && <span className="text-sm text-loss">{state.error}</span>}
      </div>
    </form>
  );
}
