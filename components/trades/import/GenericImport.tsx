"use client";

import clsx from "clsx";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { type ColumnMap, MAPPING_FIELDS, type MappingField, readCsv } from "@/lib/import/generic";
import { autoMap, BROKER_PRESETS, type BrokerPreset, detectPreset } from "@/lib/import/presets";
import { FileDrop, PreviewPanel, fetchSample, useImportFlow } from "./shared";

const SAMPLES = [
  { url: "/samples/upstox_tradebook.csv", name: "upstox_tradebook_sample.csv", label: "Upstox sample" },
  { url: "/samples/groww_orders.csv", name: "groww_orders_sample.csv", label: "Groww sample" },
];

export function GenericImport() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [firstRow, setFirstRow] = useState<Record<string, string>>({});
  const [preset, setPreset] = useState<BrokerPreset>(BROKER_PRESETS[0]);
  const [map, setMap] = useState<ColumnMap>({});
  const [qtyInLots, setQtyInLots] = useState(false);
  const [readError, setReadError] = useState<string>();

  const flow = useImportFlow(() => ({
    kind: "generic",
    map: JSON.stringify(map),
    broker: preset.id === "other" ? "GENERIC" : preset.name,
    qtyInLots: String(qtyInLots),
  }));

  async function pick(f: File) {
    flow.reset();
    setReadError(undefined);
    const { headers: hs, rows } = readCsv(await f.text());
    if (hs.length < 4 || rows.length === 0) {
      setReadError("Couldn't find a header row and data rows in this file. Is it a CSV export?");
      return;
    }
    const p = detectPreset(hs);
    setFile(f);
    setHeaders(hs);
    setFirstRow(rows[0]);
    applyPreset(p, hs);
  }

  function applyPreset(p: BrokerPreset, hs = headers) {
    setPreset(p);
    setMap(autoMap(hs, p));
    setQtyInLots(Boolean(p.qtyInLots));
    flow.reset();
  }

  function setField(f: MappingField, header: string) {
    setMap((m) => ({ ...m, [f]: header || undefined }));
    flow.reset();
  }

  const missing = MAPPING_FIELDS.filter((f) => f.required && !map[f.key]);

  return (
    <div className="space-y-4">
      <FileDrop file={file} onFile={pick} disabled={flow.previewing}>
        <p className="mb-3 text-sm text-muted">
          Upload a tradebook from Upstox, Angel One, Groww, Dhan or any broker. You&apos;ll match its columns to ours
          on the next screen; we pre-fill them for known brokers.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button key={s.url} type="button" className="btn-ghost text-xs" onClick={async () => pick(await fetchSample(s.url, s.name))}>
              Try {s.label}
            </button>
          ))}
        </div>
      </FileDrop>
      {readError && <p className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{readError}</p>}

      {file && headers.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-medium">Match your columns</h2>
          <p className="mb-3 text-sm text-muted">{headers.length} columns found. Pick your broker to pre-fill, then check each field.</p>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {BROKER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-sm",
                  preset.id === p.id ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="mb-4 text-xs text-muted">{preset.hint}</p>

          <div className="divide-y divide-border rounded-lg border border-border">
            <div className="hidden grid-cols-[1.2fr_1.2fr_1fr] gap-3 px-3 py-2 text-xs uppercase tracking-wide text-muted sm:grid">
              <span>Our field</span><span>Your column</span><span>First row</span>
            </div>
            {MAPPING_FIELDS.map((f) => {
              const header = map[f.key];
              return (
                <div key={f.key} className="grid grid-cols-1 gap-1.5 px-3 py-2 sm:grid-cols-[1.2fr_1.2fr_1fr] sm:items-center sm:gap-3">
                  <span className="text-sm">
                    {f.label}
                    {f.required && <span className="text-loss"> *</span>}
                  </span>
                  <select value={header ?? ""} onChange={(e) => setField(f.key, e.target.value)} className="input py-1.5">
                    <option value="">{f.required ? "Choose a column…" : "Not in my file"}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="truncate font-mono text-xs text-muted">{header ? firstRow[header] || "(empty)" : "—"}</span>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={qtyInLots} onChange={(e) => { setQtyInLots(e.target.checked); flow.reset(); }} />
            F&amp;O quantity is in lots (not units)
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={missing.length > 0 || flow.previewing}
              onClick={() => file && flow.preview(file)}
            >
              Preview trades <ArrowRight size={16} />
            </button>
            {missing.length > 0 ? (
              <span className="text-sm text-muted">Still needed: {missing.map((f) => f.label).join(", ")}</span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-profit"><CheckCircle2 size={14} /> All required columns mapped</span>
            )}
          </div>
        </section>
      )}

      <PreviewPanel {...flow} onImport={() => file && flow.save(file)} />
    </div>
  );
}
