"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveDayNotes } from "@/app/(app)/journal/actions";

/** Inline note editor for a trading day. Saves on button click or when you leave the box. */
export function DayNotes({ date, initial, rows = 3 }: { date: string; initial: string; rows?: number }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const dirty = value !== saved;

  function save() {
    if (!dirty) return;
    const text = value;
    start(async () => {
      const r = await saveDayNotes(date, text);
      if (r.ok) {
        setSaved(text);
        setError(undefined);
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={rows}
        placeholder="How did the day go? What did you notice about yourself?"
        className="input resize-y"
        aria-label={`Notes for ${date}`}
      />
      <div className="flex h-6 items-center gap-2 text-xs">
        {dirty && !pending && (
          <button type="button" onClick={save} className="rounded-md bg-accent px-2 py-0.5 text-accent-fg">Save note</button>
        )}
        {pending && <span className="flex items-center gap-1 text-muted"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
        {!dirty && !pending && saved && <span className="flex items-center gap-1 text-muted"><Check size={12} /> Saved</span>}
        {error && <span className="text-loss">{error}</span>}
      </div>
    </div>
  );
}
