"use client";

// Pieces shared by the Zerodha and generic importers: the drop zone, the preview
// (trades, warnings, totals, Import button) and the preview/commit flow hook.

import clsx from "clsx";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { commitUpload, previewUpload, type PreviewState } from "@/app/(app)/trades/import/actions";
import { Money } from "@/components/ui/Money";
import { formatDateIST, formatNumber, formatTimeIST } from "@/lib/format";
import { SEGMENT_LABELS } from "@/lib/types";

/** Preview/commit flow. `extra` adds importer-specific fields (kind, map, broker…). */
export function useImportFlow(extra: () => Record<string, string>) {
  const [state, setState] = useState<PreviewState>({});
  const [commitError, setCommitError] = useState<string>();
  const [previewing, startPreview] = useTransition();
  const [saving, startSave] = useTransition();

  const formData = (file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    for (const [k, v] of Object.entries(extra())) fd.set(k, v);
    return fd;
  };

  return {
    state,
    previewing,
    saving,
    commitError,
    reset: () => setState({}),
    preview(file: File) {
      setCommitError(undefined);
      const fd = formData(file);
      startPreview(async () => setState(await previewUpload(fd)));
    },
    save(file: File) {
      const fd = formData(file);
      startSave(async () => {
        const r = await commitUpload(fd); // redirects on success
        if (r?.error) setCommitError(r.error);
      });
    },
  };
}

export async function fetchSample(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: "text/csv" });
}

export function FileDrop({
  file,
  onFile,
  onSample,
  sampleUrl,
  disabled,
  children,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onSample?: () => void;
  sampleUrl?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      {children}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center"
      >
        <FileUp className="text-muted" />
        <p className="text-sm">{file ? file.name : "Drop your tradebook CSV here"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()} disabled={disabled}>
            Choose file
          </button>
          {onSample && (
            <button type="button" className="btn-ghost" onClick={onSample} disabled={disabled}>
              Try the sample file
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {sampleUrl && (
          <a href={sampleUrl} download className="text-xs text-muted underline">Download sample CSV</a>
        )}
      </div>
    </div>
  );
}

export function PreviewPanel({
  state,
  previewing,
  saving,
  commitError,
  onImport,
}: {
  state: PreviewState;
  previewing: boolean;
  saving: boolean;
  commitError?: string;
  onImport: () => void;
}) {
  if (previewing) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Reading tradebook…
      </p>
    );
  }
  if (state.error) {
    return <p className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{state.error}</p>;
  }
  const p = state.preview;
  if (!p) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="Rows read">{formatNumber(p.rowCount)}</Box>
        <Box label="New trades">{formatNumber(p.trades.length)}</Box>
        <Box label="Already imported">{formatNumber(p.duplicateFills)} fills</Box>
        <Box label="Net P&L">
          <Money value={p.totals.net} pnl />
          <span className="block text-xs text-muted">after <Money value={p.totals.charges} /> charges</span>
        </Box>
      </div>

      {(p.issues.length > 0 || p.open.length > 0) && (
        <div className="space-y-1 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm">
          {p.open.length > 0 && (
            <p className="flex gap-2 text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {p.open.length} open position{p.open.length > 1 ? "s" : ""} not imported yet (
              {p.open.map((o) => `${o.symbol} ${o.netQty > 0 ? "+" : ""}${o.netQty}`).join(", ")}). Import again after you exit.
            </p>
          )}
          {p.issues.slice(0, 5).map((i) => (
            <p key={i.row} className="text-muted">Row {i.row}: {i.message}</p>
          ))}
          {p.issues.length > 5 && <p className="text-muted">…and {p.issues.length - 5} more skipped rows.</p>}
        </div>
      )}

      {p.trades.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="tabular w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Segment</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Entry → Exit</th>
                  <th className="px-3 py-2 text-right font-medium">Charges</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {p.trades.map((t, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDateIST(t.entryAt)} <span className="text-xs text-muted">{formatTimeIST(t.entryAt)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {t.symbol}
                      <span className={clsx("ml-2 text-xs", t.direction === "LONG" ? "text-profit" : "text-loss")}>
                        {t.direction === "LONG" ? "Long" : "Short"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted">{SEGMENT_LABELS[t.segment]}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(t.qty)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-muted">
                      {formatNumber(t.avgEntry, 2)} → {formatNumber(t.avgExit, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-warn"><Money value={t.totalCharges} decimals /></td>
                    <td className="px-3 py-2 text-right font-medium"><Money value={t.netPnl} pnl decimals /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {commitError && <p className="text-sm text-loss">{commitError}</p>}
          <button type="button" className="btn-primary" onClick={onImport} disabled={saving}>
            {saving ? <><Loader2 size={16} className="animate-spin" /> Importing…</> : `Import ${p.trades.length} trades`}
          </button>
        </>
      ) : (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          Nothing new to import. {p.duplicateFills > 0 && "Every fill in this file is already in your journal."}
        </p>
      )}
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-0.5 font-medium">{children}</div>
    </div>
  );
}
