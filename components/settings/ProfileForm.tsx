"use client";

import clsx from "clsx";
import { startTransition, useActionState, useState } from "react";
import { saveProfile, type SettingsState } from "@/app/(app)/settings/actions";
import { BROKERAGE_PLANS } from "@/config/market";
import type { Level } from "@/lib/types";
import { SaveBar } from "./SaveBar";

const LEVEL_INFO: Record<Level, { title: string; text: string }> = {
  BEGINNER: { title: "Beginner", text: "Simple language. The coach explains terms like R-multiple and profit factor." },
  INTERMEDIATE: { title: "Intermediate", text: "Plain language, fewer definitions, more numbers." },
  EXPERT: { title: "Expert", text: "Concise and data-heavy. No hand-holding." },
};

export function ProfileForm({
  initial,
}: {
  initial: { name: string; level: Level; capital: number; language: "EN" | "HINGLISH"; broker: string; brokeragePlan: string };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveProfile, {});
  const [level, setLevel] = useState<Level>(initial.level);
  const [language, setLanguage] = useState(initial.language);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="language" value={language} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Your name</span>
          <input name="name" defaultValue={initial.name} maxLength={60} className="input" />
        </label>
        <label>
          <span className="label">Trading capital (₹)</span>
          <input name="capital" type="number" min="1" step="any" inputMode="decimal" defaultValue={initial.capital} className="input" />
          <span className="mt-1 block text-xs text-muted">Used for the “% of capital” view and drawdown %.</span>
        </label>
      </div>

      <div>
        <span className="label">Experience level (the AI coach adapts to this)</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(LEVEL_INFO) as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={clsx("rounded-lg border p-3 text-left", level === l ? "border-accent bg-accent/10" : "border-border hover:border-muted")}
            >
              <div className="text-sm font-medium">{LEVEL_INFO[l].title}</div>
              <div className="text-xs text-muted">{LEVEL_INFO[l].text}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="label">Coach language</span>
          <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
            {(["EN", "HINGLISH"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLanguage(l)} aria-pressed={language === l}
                className={clsx("flex-1 rounded-md px-3 py-1.5 text-sm", language === l ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
                {l === "EN" ? "English" : "Hinglish"}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span className="label">Broker</span>
          <input name="broker" defaultValue={initial.broker} maxLength={40} placeholder="e.g. Zerodha" className="input" />
        </label>
        <label>
          <span className="label">Brokerage plan</span>
          <select name="brokeragePlan" defaultValue={initial.brokeragePlan} className="input">
            {Object.entries(BROKERAGE_PLANS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
          <span className="mt-1 block text-xs text-muted">Changing this recalculates charges on all trades.</span>
        </label>
      </div>
      <SaveBar pending={pending} state={state} label="Save profile" />
    </form>
  );
}
