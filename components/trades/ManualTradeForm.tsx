"use client";

import clsx from "clsx";
import { startTransition, useActionState, useMemo, useState } from "react";
import { createTrade, type CreateTradeState } from "@/app/(app)/trades/actions";
import { INDICES, STOCK_LOT_SIZES } from "@/config/market";
import { computeTradePnl, chargesPctOfGross } from "@/lib/charges";
import { lotSizeFor, nextExpiry } from "@/lib/expiry";
import { formatINR, istDateKey, pnlClass } from "@/lib/format";
import { SEGMENT_LABELS, type Direction, type Exchange, type OptionType, type Segment } from "@/lib/types";

const SEGMENT_ORDER: Segment[] = ["OPT", "FUT", "EQ_INTRADAY", "EQ_DELIVERY"];
const SYMBOL_SUGGESTIONS = [...Object.keys(INDICES), ...Object.keys(STOCK_LOT_SIZES)];

function Toggle<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; className?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
      <input type="hidden" name={name} value={value} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
            value === o.value ? (o.className ?? "bg-accent text-accent-fg") : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, error, children, className }: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-loss">{error}</span>}
    </label>
  );
}

export function ManualTradeForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<CreateTradeState, FormData>(createTrade, {});
  const err = state.fieldErrors ?? {};

  const [segment, setSegment] = useState<Segment>("OPT");
  const [underlying, setUnderlying] = useState("NIFTY");
  const [exchange, setExchange] = useState<Exchange>("NSE");
  const [optionType, setOptionType] = useState<OptionType>("CE");
  const [direction, setDirection] = useState<Direction>("LONG");
  const [lots, setLots] = useState("1");
  const [lotSize, setLotSize] = useState(String(lotSizeFor("NIFTY") ?? ""));
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [expiry, setExpiry] = useState(() => istDateKey(nextExpiry("NIFTY", new Date(`${today}T12:00:00+05:30`))));

  const isFno = segment === "OPT" || segment === "FUT";

  function onUnderlying(value: string) {
    setUnderlying(value);
    const u = value.trim().toUpperCase();
    const ls = lotSizeFor(u);
    if (ls) setLotSize(String(ls));
    if (INDICES[u]) {
      setExchange(INDICES[u].exchange);
      setExpiry(istDateKey(nextExpiry(u, new Date(`${today}T12:00:00+05:30`))));
    }
  }

  const effectiveQty = isFno ? Number(lots) * Number(lotSize) : Number(qty);

  // Live preview: the same engine the server uses.
  const preview = useMemo(() => {
    const e = Number(entry);
    const x = Number(exit);
    if (!(effectiveQty > 0 && e > 0 && x > 0)) return null;
    return computeTradePnl({ exchange, segment, direction, qty: effectiveQty, avgEntry: e, avgExit: x });
  }, [entry, exit, effectiveQty, exchange, segment, direction]);

  const pct = preview ? chargesPctOfGross(preview.totalCharges, preview.grossPnl) : null;

  return (
    <form
      // Submit via a transition rather than `action={...}` so React doesn't reset
      // uncontrolled fields when validation fails.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]"
    >
      <div className="@container space-y-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <input type="hidden" name="segment" value={segment} />
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-0.5 @lg:grid-cols-4">
          {SEGMENT_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSegment(s)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm",
                segment === s ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
              )}
            >
              {SEGMENT_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-3">
          <Field label="Symbol / underlying" error={err.underlying} className="col-span-2 @2xl:col-span-1">
            <input
              name="underlying"
              list="symbols"
              className="input uppercase"
              value={underlying}
              onChange={(e) => onUnderlying(e.target.value)}
              autoComplete="off"
            />
            <datalist id="symbols">
              {SYMBOL_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Exchange">
            <Toggle
              name="exchange"
              value={exchange}
              onChange={setExchange}
              options={[{ value: "NSE", label: "NSE" }, { value: "BSE", label: "BSE" }]}
            />
          </Field>
          <Field label="Direction">
            <Toggle
              name="direction"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "LONG", label: "Long", className: "bg-profit/20 text-profit" },
                { value: "SHORT", label: "Short", className: "bg-loss/20 text-loss" },
              ]}
            />
          </Field>
        </div>

        {isFno && (
          <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
            {segment === "OPT" && (
              <>
                <Field label="Strike" error={err.strike}>
                  <input name="strike" type="number" step="any" inputMode="decimal" className="input" />
                </Field>
                <Field label="Type" error={err.optionType}>
                  <Toggle
                    name="optionType"
                    value={optionType}
                    onChange={setOptionType}
                    options={[{ value: "CE", label: "CE" }, { value: "PE", label: "PE" }]}
                  />
                </Field>
              </>
            )}
            <Field label="Expiry" error={err.expiry}>
              <input name="expiry" type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </Field>
            <Field label={`Lots × lot size (= ${effectiveQty || 0} qty)`}>
              <div className="flex gap-2">
                <input type="number" min="1" step="1" inputMode="numeric" className="input" value={lots} onChange={(e) => setLots(e.target.value)} />
                <input name="lotSize" type="number" min="1" inputMode="numeric" className="input" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
              </div>
            </Field>
          </div>
        )}
        {isFno && <input type="hidden" name="qty" value={effectiveQty || ""} />}

        <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
          {!isFno && (
            <Field label="Quantity" error={err.qty}>
              <input name="qty" type="number" min="1" step="any" inputMode="decimal" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
          )}
          <Field label={segment === "OPT" ? "Entry premium" : "Entry price"} error={err.avgEntry}>
            <input name="avgEntry" type="number" step="any" inputMode="decimal" className="input" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </Field>
          <Field label={segment === "OPT" ? "Exit premium" : "Exit price"} error={err.avgExit}>
            <input name="avgExit" type="number" step="any" inputMode="decimal" className="input" value={exit} onChange={(e) => setExit(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
          <Field label="Date" error={err.entryDate}>
            <input name="entryDate" type="date" className="input" defaultValue={today} />
          </Field>
          {segment === "EQ_DELIVERY" && (
            <Field label="Exit date">
              <input name="exitDate" type="date" className="input" defaultValue={today} />
            </Field>
          )}
          <Field label="Entry time (IST)" error={err.entryTime}>
            <input name="entryTime" type="time" className="input" defaultValue="09:30" />
          </Field>
          <Field label="Exit time (IST)" error={err.exitTime}>
            <input name="exitTime" type="time" className="input" defaultValue="10:00" />
          </Field>
        </div>

        <details className="group rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted">Plan (optional): stop-loss, target, notes</summary>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field label="Stop-loss price" error={err.plannedSL}>
              <input name="plannedSL" type="number" step="any" inputMode="decimal" className="input" />
            </Field>
            <Field label="Target price" error={err.plannedTarget}>
              <input name="plannedTarget" type="number" step="any" inputMode="decimal" className="input" />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea name="notes" rows={3} className="input" placeholder="Why did you take this trade?" />
            </Field>
          </div>
        </details>

        {state.error && <p className="text-sm text-loss">{state.error}</p>}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : "Save trade"}
        </button>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-6">
        <h2 className="mb-3 text-sm font-medium text-muted">Live P&amp;L preview</h2>
        {preview ? (
          <dl className="tabular space-y-1.5 text-sm">
            <Row label="Gross P&L" value={formatINR(preview.grossPnl, { decimals: true, signed: true })} className={pnlClass(preview.grossPnl)} />
            <Row label="Brokerage" value={formatINR(preview.brokerage, { decimals: true })} muted />
            <Row label="STT" value={formatINR(preview.stt, { decimals: true })} muted />
            <Row label="Exchange charges" value={formatINR(preview.exchangeTxn, { decimals: true })} muted />
            <Row label="SEBI fee" value={formatINR(preview.sebiFee, { decimals: true })} muted />
            <Row label="Stamp duty" value={formatINR(preview.stampDuty, { decimals: true })} muted />
            <Row label="GST" value={formatINR(preview.gst, { decimals: true })} muted />
            {preview.otherCharges > 0 && <Row label="DP charge" value={formatINR(preview.otherCharges, { decimals: true })} muted />}
            <Row label="Total charges" value={formatINR(-preview.totalCharges, { decimals: true })} className="border-t border-border pt-1.5 text-warn" />
            <Row label="Net P&L" value={formatINR(preview.netPnl, { decimals: true, signed: true })} className={clsx("text-base font-semibold", pnlClass(preview.netPnl))} />
            {pct != null && (
              <p className="pt-2 text-xs text-muted">
                Charges eat <span className="font-medium text-warn">{pct.toFixed(1)}%</span> of this trade&apos;s gross profit.
              </p>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted">Enter quantity, entry and exit to see gross P&amp;L, every charge, and net P&amp;L.</p>
        )}
      </aside>
    </form>
  );
}

function Row({ label, value, className, muted }: { label: string; value: string; className?: string; muted?: boolean }) {
  return (
    <div className={clsx("flex justify-between gap-4", muted && "text-muted", className)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
