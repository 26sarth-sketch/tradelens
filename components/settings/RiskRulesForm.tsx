"use client";

import { startTransition, useActionState } from "react";
import { saveRiskRules, type SettingsState } from "@/app/(app)/settings/actions";
import type { RiskLimits } from "@/lib/rules";
import { SaveBar } from "./SaveBar";

const FIELDS: { key: keyof RiskLimits; label: string; hint: string; type: "money" | "int" | "time"; placeholder: string }[] = [
  { key: "maxDailyLoss", label: "Max daily loss (₹)", hint: "Stop for the day once your running loss passes this.", type: "money", placeholder: "e.g. 4000" },
  { key: "maxTradesPerDay", label: "Max trades per day", hint: "Every trade beyond this counts as overtrading.", type: "int", placeholder: "e.g. 3" },
  { key: "maxLossPerTrade", label: "Max loss per trade (₹)", hint: "No single trade should lose more than this.", type: "money", placeholder: "e.g. 2000" },
  { key: "maxConsecutiveLosses", label: "Stop after N losses in a row", hint: "The classic revenge-trading guard.", type: "int", placeholder: "e.g. 2" },
  { key: "noTradeAfter", label: "No new trades after (IST)", hint: "Afternoon chop and expiry decay hurt most traders.", type: "time", placeholder: "" },
];

export function RiskRulesForm({ initial }: { initial: RiskLimits }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveRiskRules, {});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      <p className="text-xs text-muted">Leave a box empty to turn that rule off. Saving re-checks your whole history.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span className="label">{f.label}</span>
            <input
              name={f.key}
              type={f.type === "time" ? "time" : "number"}
              min={f.type === "time" ? undefined : 1}
              step={f.type === "int" ? 1 : "any"}
              inputMode={f.type === "time" ? undefined : "decimal"}
              defaultValue={initial[f.key] ?? ""}
              placeholder={f.placeholder}
              className="input"
            />
            <span className="mt-1 block text-xs text-muted">{f.hint}</span>
          </label>
        ))}
      </div>
      <SaveBar pending={pending} state={state} label="Save risk rules" />
    </form>
  );
}
