"use client";

import clsx from "clsx";
import { Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { type ReviewState, updateTradeReview } from "@/app/(app)/trades/actions";
import { Money } from "@/components/ui/Money";
import { computeR, excursions } from "@/lib/trades";
import { EMOTIONS, type Emotion } from "@/lib/types";

type Rule = { id: string; text: string };
export type StrategyOption = { id: string; name: string; entryRules: Rule[]; exitRules: Rule[]; riskRules: Rule[] };

export type ReviewInitial = {
  strategyId: string | null;
  checkedRules: string[];
  tags: string[];
  emotionBefore: string | null;
  emotionAfter: string | null;
  followedPlan: boolean | null;
  plannedSL: number | null;
  plannedTarget: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  notes: string;
  screenshotUrl: string | null;
};

type TradeFacts = { direction: string; qty: number; avgEntry: number; avgExit: number; netPnl: number };

const SUGGESTED_TAGS = ["A+ setup", "Chased entry", "Revenge trade", "Overtrading", "Moved stop-loss", "Held loser too long", "Exited early", "News"];

const num = (s: string) => (s.trim() === "" ? null : Number(s));

function Pills<T extends string>({ value, options, onChange }: { value: T | null; options: readonly T[]; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? null : o)}
          aria-pressed={value === o}
          className={clsx(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            value === o ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function TradeReviewForm({
  tradeId,
  trade,
  initial,
  strategies,
  allTags,
}: {
  tradeId: string;
  trade: TradeFacts;
  initial: ReviewInitial;
  strategies: StrategyOption[];
  allTags: string[];
}) {
  const [state, action, saving] = useActionState<ReviewState, FormData>(updateTradeReview.bind(null, tradeId), {});
  const err = state.fieldErrors ?? {};

  const [strategyId, setStrategyId] = useState(initial.strategyId ?? "");
  const [checked, setChecked] = useState<string[]>(initial.checkedRules);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [emotionBefore, setEmotionBefore] = useState<Emotion | null>(initial.emotionBefore as Emotion | null);
  const [emotionAfter, setEmotionAfter] = useState<Emotion | null>(initial.emotionAfter as Emotion | null);
  const [followed, setFollowed] = useState<"yes" | "no" | null>(initial.followedPlan == null ? null : initial.followedPlan ? "yes" : "no");
  const [sl, setSl] = useState(initial.plannedSL?.toString() ?? "");
  const [target, setTarget] = useState(initial.plannedTarget?.toString() ?? "");
  const [high, setHigh] = useState(initial.highPrice?.toString() ?? "");
  const [low, setLow] = useState(initial.lowPrice?.toString() ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [shotPreview, setShotPreview] = useState<string | null>(initial.screenshotUrl);
  const [removeShot, setRemoveShot] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const touch = <A,>(fn: (a: A) => void) => (a: A) => {
    fn(a);
    setDirty(true);
  };

  const strategy = strategies.find((s) => s.id === strategyId);
  const allRules = strategy ? [...strategy.entryRules, ...strategy.exitRules, ...strategy.riskRules] : [];
  const metCount = allRules.filter((r) => checked.includes(r.id)).length;

  // Live previews, same formulas as the server.
  const r = useMemo(
    () => computeR({ avgEntry: trade.avgEntry, qty: trade.qty, plannedSL: num(sl), plannedTarget: num(target) }, trade.netPnl),
    [sl, target, trade],
  );
  const exc = useMemo(() => excursions({ ...trade, highPrice: num(high), lowPrice: num(low) }), [high, low, trade]);

  function addTag(raw: string) {
    const t = raw.trim().slice(0, 30);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) touch(setTags)([...tags, t]);
    setTagDraft("");
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("strategyId", strategyId);
    fd.set("checkedRules", JSON.stringify(checked.filter((id) => allRules.some((r) => r.id === id))));
    fd.set("tags", JSON.stringify(tags));
    fd.set("emotionBefore", emotionBefore ?? "");
    fd.set("emotionAfter", emotionAfter ?? "");
    fd.set("followedPlan", followed ?? "");
    fd.set("removeScreenshot", removeShot ? "1" : "");
    // Submit via a transition so React doesn't reset the form (see ManualTradeForm).
    startTransition(() => action(fd));
    setDirty(false);
  }

  const savedRecently = state.ok && !dirty;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Strategy" hint={strategy && allRules.length > 0 ? `${metCount} of ${allRules.length} rules met` : undefined}>
          <select
            value={strategyId}
            onChange={(e) => {
              touch(setStrategyId)(e.target.value);
              setChecked([]);
            }}
            className="input"
          >
            <option value="">No strategy</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {strategy && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {(
                [
                  ["Entry", strategy.entryRules],
                  ["Exit", strategy.exitRules],
                  ["Risk", strategy.riskRules],
                ] as const
              ).map(([label, rules]) =>
                rules.length ? (
                  <div key={label}>
                    <div className="mb-1 text-xs uppercase tracking-wide text-muted">{label}</div>
                    {rules.map((rule) => (
                      <label key={rule.id} className="flex items-start gap-2 py-0.5 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked.includes(rule.id)}
                          onChange={(e) =>
                            touch(setChecked)(e.target.checked ? [...checked, rule.id] : checked.filter((x) => x !== rule.id))
                          }
                        />
                        {rule.text}
                      </label>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section title="Did you follow your plan?">
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={followed === v}
                  onClick={() => touch(setFollowed)(followed === v ? null : v)}
                  className={clsx(
                    "flex-1 rounded-lg border px-3 py-2 text-sm",
                    followed === v
                      ? v === "yes" ? "border-profit bg-profit/15 text-profit" : "border-loss bg-loss/15 text-loss"
                      : "border-border text-muted hover:text-fg",
                  )}
                >
                  {v === "yes" ? "Yes, followed my plan" : "No, I broke my plan"}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Emotion before entry">
            <Pills value={emotionBefore} options={EMOTIONS} onChange={touch(setEmotionBefore)} />
          </Section>
          <Section title="Emotion after exit">
            <Pills value={emotionAfter} options={EMOTIONS} onChange={touch(setEmotionAfter)} />
          </Section>
        </div>
      </div>

      <Section title="Tags">
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-2.5 pr-1 text-sm">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => touch(setTags)(tags.filter((x) => x !== t))} className="rounded-full p-0.5 text-muted hover:text-fg">
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagDraft);
              }
            }}
            onBlur={() => tagDraft && addTag(tagDraft)}
            list="tag-options"
            placeholder="Add a tag…"
            className="input w-40 py-1"
          />
          <datalist id="tag-options">
            {[...new Set([...allTags, ...SUGGESTED_TAGS])].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-wrap gap-1">
          {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted hover:text-fg">
              + {t}
            </button>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Risk plan" hint="Stop-loss gives you R">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Stop-loss price</span>
              <input name="plannedSL" type="number" step="any" inputMode="decimal" className="input" value={sl} onChange={(e) => touch(setSl)(e.target.value)} />
              {err.plannedSL && <span className="text-xs text-loss">{err.plannedSL}</span>}
            </label>
            <label>
              <span className="label">Target price</span>
              <input name="plannedTarget" type="number" step="any" inputMode="decimal" className="input" value={target} onChange={(e) => touch(setTarget)(e.target.value)} />
            </label>
          </div>
          <p className="tabular text-sm text-muted">
            Planned reward:risk <span className="text-fg">{r.plannedR != null ? `1 : ${r.plannedR.toFixed(2)}` : "—"}</span>
            {" · "}Result{" "}
            <span className={clsx(r.rMultiple == null ? "text-fg" : r.rMultiple > 0 ? "text-profit" : "text-loss")}>
              {r.rMultiple != null ? `${r.rMultiple.toFixed(2)}R` : "—"}
            </span>
          </p>
        </Section>

        <Section title="Price range during the trade" hint="Optional: shows money left on the table">
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Highest price</span>
              <input name="highPrice" type="number" step="any" inputMode="decimal" className="input" value={high} onChange={(e) => touch(setHigh)(e.target.value)} />
              {err.highPrice && <span className="text-xs text-loss">{err.highPrice}</span>}
            </label>
            <label>
              <span className="label">Lowest price</span>
              <input name="lowPrice" type="number" step="any" inputMode="decimal" className="input" value={low} onChange={(e) => touch(setLow)(e.target.value)} />
            </label>
          </div>
          {exc && (
            <dl className="tabular grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted">Best open profit</dt><dd><Money value={exc.mfe} className="text-profit" /></dd></div>
              <div><dt className="text-xs text-muted">Worst open loss</dt><dd><Money value={-exc.mae} className="text-loss" /></dd></div>
              <div>
                <dt className="text-xs text-muted">Left on table</dt>
                <dd><Money value={exc.leftOnTable} className="text-warn" /></dd>
              </div>
              {exc.capturedPct != null && (
                <p className="col-span-3 text-xs text-muted">
                  {exc.capturedPct < 0
                    ? `It was up at ${exc.bestPrice} before turning into a loss.`
                    : `You captured ${exc.capturedPct}% of the best move (best price ${exc.bestPrice}).`}
                </p>
              )}
            </dl>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Notes">
          <textarea
            name="notes"
            rows={6}
            className="input"
            value={notes}
            onChange={(e) => touch(setNotes)(e.target.value)}
            placeholder="Why did you take it? What did you see? What would you do differently?"
          />
        </Section>

        <Section title="Chart screenshot" hint="PNG, JPG, WebP or GIF, up to 5 MB">
          <input
            ref={fileRef}
            name="screenshot"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setShotPreview(URL.createObjectURL(f));
                setRemoveShot(false);
                setDirty(true);
              }
            }}
          />
          {shotPreview ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local upload / blob preview */}
              <img src={shotPreview} alt="Trade chart screenshot" className="max-h-64 w-full rounded-lg border border-border object-contain" />
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={14} /> Replace
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs text-loss"
                  onClick={() => {
                    if (fileRef.current) fileRef.current.value = "";
                    setShotPreview(null);
                    setRemoveShot(true);
                    setDirty(true);
                  }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted hover:text-fg"
            >
              <ImagePlus /> Add a screenshot of your chart
            </button>
          )}
          {err.screenshot && <p className="text-xs text-loss">{err.screenshot}</p>}
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Save review"}
        </button>
        {savedRecently && <span className="flex items-center gap-1 text-sm text-profit"><Check size={14} /> Saved</span>}
        {dirty && !saving && <span className="text-sm text-muted">Unsaved changes</span>}
        {state.error && <span className="text-sm text-loss">{state.error}</span>}
      </div>
    </form>
  );
}
