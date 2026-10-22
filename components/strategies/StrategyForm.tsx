"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Loader2, Plus, X } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { saveStrategy, type StrategyFormState } from "@/app/(app)/strategies/actions";
import { newRuleId } from "@/lib/playbook";
import type { Rule } from "@/lib/strategies";

const COLORS = ["#ffc83d", "#6d5efc", "#3987e5", "#22c55e", "#f5a524", "#d95926", "#d55181", "#199e70", "#8a94a6"];

type Group = { key: "entryRules" | "exitRules" | "riskRules"; prefix: "e" | "x" | "r"; title: string; hint: string; placeholder: string };

const GROUPS: Group[] = [
  { key: "entryRules", prefix: "e", title: "Entry rules", hint: "What must be true before you enter?", placeholder: "e.g. 5-min candle closes above the opening range" },
  { key: "exitRules", prefix: "x", title: "Exit rules", hint: "When do you take profit or get out?", placeholder: "e.g. Book half at 1R, trail the rest" },
  { key: "riskRules", prefix: "r", title: "Risk rules", hint: "Size, stop-loss and limits.", placeholder: "e.g. Stop-loss at 20% of premium, max 2 lots" },
];

export type StrategyFormValues = {
  name: string;
  description: string;
  color: string;
  entryRules: Rule[];
  exitRules: Rule[];
  riskRules: Rule[];
};

export function StrategyForm({ id, initial }: { id: string | null; initial: StrategyFormValues }) {
  const [state, action, saving] = useActionState<StrategyFormState, FormData>(saveStrategy.bind(null, id), {});
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);
  const [rules, setRules] = useState({ entryRules: initial.entryRules, exitRules: initial.exitRules, riskRules: initial.riskRules });
  // Rule just added via "Add rule", so its box can take focus.
  const [added, setAdded] = useState<string | null>(null);

  const update = (g: Group["key"], fn: (rs: Rule[]) => Rule[]) => setRules((r) => ({ ...r, [g]: fn(r[g]) }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    fd.set("color", color);
    for (const g of GROUPS) fd.set(g.key, JSON.stringify(rules[g.key].filter((r) => r.text.trim())));
    startTransition(() => action(fd));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <label className="block">
            <span className="label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input" placeholder="e.g. 15-min Opening Range Breakout" />
            {state.fieldErrors?.name && <span className="text-xs text-loss">{state.fieldErrors.name}</span>}
          </label>
          <label className="block">
            <span className="label">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000} className="input" placeholder="What's the idea behind this setup? When does it work?" />
          </label>
        </div>
        <div>
          <span className="label">Colour</span>
          <div className="grid grid-cols-4 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={clsx("h-8 w-8 rounded-full border-2", color === c ? "border-fg" : "border-transparent")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => {
          const list = rules[g.key];
          return (
            <section key={g.key} className="rounded-xl border border-border bg-surface p-4">
              <h2 className="font-medium">{g.title}</h2>
              <p className="mb-3 text-xs text-muted">{g.hint}</p>
              <ol className="space-y-2">
                {list.map((r, i) => (
                  <li key={r.id} className="flex items-start gap-1.5">
                    <span className="mt-2 w-4 text-right text-xs text-muted">{i + 1}.</span>
                    <textarea
                      value={r.text}
                      onChange={(e) => update(g.key, (rs) => rs.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                      rows={2}
                      maxLength={200}
                      placeholder={g.placeholder}
                      className="input min-h-0 flex-1 py-1.5"
                      aria-label={`${g.title} ${i + 1}`}
                      autoFocus={`${g.key}:${r.id}` === added}
                    />
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => update(g.key, (rs) => { const c = [...rs]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="p-0.5 text-muted hover:text-fg disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button type="button" aria-label="Move down" disabled={i === list.length - 1} onClick={() => update(g.key, (rs) => { const c = [...rs]; [c[i], c[i + 1]] = [c[i + 1], c[i]]; return c; })} className="p-0.5 text-muted hover:text-fg disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                    <button type="button" aria-label="Remove rule" onClick={() => update(g.key, (rs) => rs.filter((x) => x.id !== r.id))} className="mt-1.5 p-0.5 text-muted hover:text-loss"><X size={16} /></button>
                  </li>
                ))}
              </ol>
              {list.length < 15 && (
                <button
                  type="button"
                  onClick={() => {
                    const id = newRuleId(g.prefix, list.map((x) => x.id));
                    update(g.key, (rs) => [...rs, { id, text: "" }]);
                    setAdded(`${g.key}:${id}`);
                  }}
                  className="mt-3 flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  <Plus size={14} /> Add rule
                </button>
              )}
              {state.fieldErrors?.[g.key] && <p className="mt-2 text-xs text-loss">{state.fieldErrors[g.key]}</p>}
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : id ? "Save strategy" : "Create strategy"}
        </button>
        {state.error && <span className="text-sm text-loss">{state.error}</span>}
      </div>
    </form>
  );
}
