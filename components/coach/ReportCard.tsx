"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { runReport } from "@/app/(app)/coach/actions";
import type { ReportResult, ReportType, StoredReport } from "@/lib/ai/coach";
import type { FirstImport, Session, Weekly } from "@/lib/ai/schemas";
import { formatDateTimeIST } from "@/lib/format";
import { VerificationBadge } from "./VerificationBadge";

type Insight = { title: string; detail: string; evidence: string };

function InsightList({ items, tone }: { items: Insight[]; tone: "good" | "bad" }) {
  const Icon = tone === "good" ? TrendingUp : TrendingDown;
  return (
    <ul className="space-y-3">
      {items.map((i, n) => (
        <li key={n} className="flex gap-2.5">
          <Icon size={17} className={clsx("mt-0.5 shrink-0", tone === "good" ? "text-profit" : "text-loss")} aria-hidden />
          <div>
            <div className="text-sm font-medium">{i.title}</div>
            <p className="text-sm text-muted">{i.detail}</p>
            <p className="tabular mt-0.5 rounded bg-surface-2 px-2 py-1 text-xs">{i.evidence}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function FirstImportView({ r }: { r: FirstImport }) {
  return (
    <div className="space-y-5">
      <p className="text-sm">{r.summary}</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="What's working"><InsightList items={r.strengths} tone="good" /></Section>
        <Section title="Where money leaks"><InsightList items={r.leaks} tone="bad" /></Section>
      </div>
      <NextSteps title="Your next 3 process steps" items={r.next_steps} />
    </div>
  );
}

function WeeklyView({ r }: { r: Weekly }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Top 3 strengths"><InsightList items={r.strengths} tone="good" /></Section>
        <Section title="Top 3 mistakes"><InsightList items={r.mistakes} tone="bad" /></Section>
      </div>
      <Section title="3 rules for next week">
        <ol className="space-y-2">
          {r.rules_for_next_week.map((x, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg">{i + 1}</span>
              <div>
                <div className="text-sm font-medium">{x.rule}</div>
                <div className="text-xs text-muted">{x.why}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

const VERDICT: Record<Session["verdict"], { label: string; cls: string }> = {
  disciplined: { label: "Disciplined", cls: "bg-profit/15 text-profit" },
  mixed: { label: "Mixed", cls: "bg-warn/15 text-warn" },
  undisciplined: { label: "Undisciplined", cls: "bg-loss/15 text-loss" },
  no_trades: { label: "No trades", cls: "bg-surface-2 text-muted" },
};

function SessionView({ r }: { r: Session }) {
  return (
    <div className="space-y-5">
      <span className={clsx("inline-block rounded px-2 py-0.5 text-xs font-medium uppercase", VERDICT[r.verdict].cls)}>{VERDICT[r.verdict].label}</span>
      {r.rule_breaks.length > 0 && (
        <Section title="Rules broken">
          <ul className="space-y-2">
            {r.rule_breaks.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <XCircle size={17} className="mt-0.5 shrink-0 text-loss" aria-hidden />
                <div><span className="font-medium">{b.rule}:</span> <span className="text-muted">{b.what_happened}</span></div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Went well">
          <ul className="space-y-1.5">{r.went_well.map((x, i) => <li key={i} className="flex gap-2 text-sm"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-profit" aria-hidden />{x}</li>)}</ul>
        </Section>
        <Section title="To fix">
          <ul className="space-y-1.5">{r.to_fix.map((x, i) => <li key={i} className="flex gap-2 text-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />{x}</li>)}</ul>
        </Section>
      </div>
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted">Tomorrow&apos;s focus</span>
        <p className="font-medium">{r.tomorrow_focus}</p>
      </div>
    </div>
  );
}

function NextSteps({ title, items }: { title: string; items: string[] }) {
  return (
    <Section title={title}>
      <ol className="space-y-2">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </Section>
  );
}

const LABELS: Record<ReportType, { cta: string; loading: string }> = {
  FIRST_IMPORT: { cta: "Analyse my journal", loading: "Reading your journal…" },
  WEEKLY: { cta: "Generate weekly review", loading: "Reviewing your week…" },
  SESSION: { cta: "Review this session", loading: "Comparing your plan with your trades…" },
};

/** Renders a cached AI report, or a button to generate one. */
export function ReportCard({
  type,
  reportKey,
  initial,
  aiEnabled,
  title,
  subtitle,
  autoGenerate = false,
}: {
  type: ReportType;
  /** Start generating on mount when there's no cached report (e.g. right after an import). */
  autoGenerate?: boolean;
  reportKey: string;
  initial: StoredReport | null;
  aiEnabled: boolean;
  title: string;
  subtitle?: string;
}) {
  const [report, setReport] = useState<StoredReport | null>(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res: ReportResult = await runReport(type, reportKey);
      if (res.ok) {
        setReport(res.report);
        setError(undefined);
      } else setError(res.message);
    });
  }
  function generate() {
    setError(undefined);
    run();
  }

  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoGenerate && aiEnabled && !initial && !autoStarted.current) {
      autoStarted.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const out = report?.output as (FirstImport & Weekly & Session) | undefined;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium"><Sparkles size={17} className="text-accent" /> {title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {report && aiEnabled && (
          <button type="button" onClick={generate} disabled={pending} className="btn-ghost py-1 text-xs">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerate
          </button>
        )}
      </div>

      {pending && !report && (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> {LABELS[type].loading}</p>
      )}

      {!report && !pending && (
        <div className="flex flex-col items-start gap-3 py-2">
          {aiEnabled ? (
            <button type="button" onClick={generate} className="btn-primary"><Sparkles size={16} /> {LABELS[type].cta}</button>
          ) : (
            <p className="text-sm text-muted">AI Coach is off. Add <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-surface-2 px-1">.env</code> and restart the app.</p>
          )}
        </div>
      )}

      {error && <p className="mt-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}

      {report && out && (
        <div className={clsx("space-y-4 transition-opacity", pending && "opacity-50")}>
          <p className="text-lg font-medium leading-snug">{out.headline}</p>
          {type === "FIRST_IMPORT" && <FirstImportView r={out} />}
          {type === "WEEKLY" && <WeeklyView r={out} />}
          {type === "SESSION" && <SessionView r={out} />}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted">
            <VerificationBadge v={report.verification} />
            <span>{report.scope} · generated {formatDateTimeIST(report.generatedAt)} · {report.model}</span>
          </div>
        </div>
      )}
    </section>
  );
}
