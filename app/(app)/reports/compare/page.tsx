import clsx from "clsx";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { CompareCurve } from "@/components/reports/CompareCurve";
import { FilterBar } from "@/components/reports/FilterBar";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { COMPARE_PRESETS, compareMetrics, cumulativeByTrade, type MetricRow } from "@/lib/compare";
import { applyFilter, describeFilter, FILTER_KEYS, filterToParams, parseFilter, type TradeFilter } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import { loadFilterOptions, loadReportTrades } from "@/lib/report-data";
import { EMOTIONS } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Compare" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ComparePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);

  // Base filter (date, segment, strategy, tag) applies to both sets.
  const base = parseFilter(sp);
  const custom = Object.keys(sp).some((k) => k.startsWith("a.") || k.startsWith("b."));
  const preset = COMPARE_PRESETS.find((p) => p.key === one(sp.preset)) ?? COMPARE_PRESETS[0];
  const A = custom ? { name: one(sp["a.name"])?.slice(0, 40) || "Set A", filter: parseFilter(sp, "a.") } : preset.a;
  const B = custom ? { name: one(sp["b.name"])?.slice(0, 40) || "Set B", filter: parseFilter(sp, "b.") } : preset.b;

  const [all, options] = await Promise.all([loadReportTrades(user.id, base), loadFilterOptions(user.id)]);
  const pool = applyFilter(all, base);
  const a = applyFilter(pool, A.filter);
  const b = applyFilter(pool, B.filter);
  const { sa, sb, rows } = compareMetrics(a, b, user.profile?.capital);
  const curve = cumulativeByTrade(a, b);

  const baseParams = () => filterToParams(base);
  const presetHref = (key: string) => {
    const p = baseParams();
    p.set("preset", key);
    return `/reports/compare?${p}`;
  };
  const diff = sa.expectancy - sb.expectancy;

  return (
    <>
      <Link href="/reports" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Reports
      </Link>
      <PageHeader title="Compare" description="Put any two sets of your trades side by side." />

      <FilterBar
        action="/reports/compare"
        filter={base}
        strategies={options.strategies}
        tags={options.tags}
        keep={
          custom
            ? Object.fromEntries(Object.entries(sp).filter(([k]) => k.startsWith("a.") || k.startsWith("b.")).map(([k, v]) => [k, one(v)]))
            : { preset: preset.key }
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {COMPARE_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={presetHref(p.key)}
            scroll={false}
            className={clsx(
              "rounded-full border px-3 py-1 text-sm",
              !custom && p.key === preset.key ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <details className="mb-4 rounded-xl border border-border bg-surface" open={custom}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Build your own comparison</summary>
        <form action="/reports/compare" className="space-y-4 border-t border-border p-4">
          {FILTER_KEYS.filter((k) => base[k] != null).map((k) => (
            <input key={k} type="hidden" name={k} value={String(Array.isArray(base[k]) ? (base[k] as string[]).join(",") : base[k])} />
          ))}
          <div className="grid gap-4 md:grid-cols-2">
            <SetFields prefix="a." name={A.name} filter={A.filter} swatch="var(--series-a)" />
            <SetFields prefix="b." name={B.name} filter={B.filter} swatch="var(--series-b)" />
          </div>
          <button className="btn-primary">Compare</button>
        </form>
      </details>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {[
          { key: "A", set: A, s: sa, color: "var(--series-a)" },
          { key: "B", set: B, s: sb, color: "var(--series-b)" },
        ].map(({ key, set, s, color }) => (
          <div key={key} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: color }} aria-hidden />
              <span className="text-xs text-muted">{key}</span>
              <span className="font-medium">{set.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{describeFilter(set.filter, { strategies: options.strategyNames })}</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Money value={s.net} pnl className="text-2xl font-semibold" />
              <span className="text-sm text-muted">{s.count} trades · {s.winRate.toFixed(0)}% wins · <Money value={s.expectancy} pnl /> per trade</span>
            </div>
          </div>
        ))}
      </div>

      {sa.count > 0 && sb.count > 0 && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
          On average, each trade in <span className="font-medium">“{diff >= 0 ? A.name : B.name}”</span> made{" "}
          <Money value={Math.abs(diff)} className="font-semibold" /> more than each trade in{" "}
          <span className="font-medium">“{diff >= 0 ? B.name : A.name}”</span>
          {" "}({formatNumber(sa.count)} vs {formatNumber(sb.count)} trades).
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="tabular w-full min-w-[520px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Metric</th>
                <th className="px-3 py-2.5 text-right font-medium">A · {A.name}</th>
                <th className="px-3 py-2.5 text-right font-medium">B · {B.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted">{r.label}</td>
                  <td className="px-3 py-2 text-right"><MetricValue row={r} side="a" /></td>
                  <td className="px-3 py-2 text-right"><MetricValue row={r} side="b" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border px-3 py-2 text-xs text-muted"><Check size={12} className="inline text-profit" /> marks the better side for each metric.</p>
        </div>
        <Card title="Cumulative net P&L, trade by trade">
          <CompareCurve data={curve} nameA={A.name} nameB={B.name} />
        </Card>
      </div>
    </>
  );
}

function MetricValue({ row, side }: { row: MetricRow; side: "a" | "b" }) {
  const v = row[side];
  const win = row.winner === side;
  let body: React.ReactNode;
  if (v == null) body = <span className="text-muted">—</span>;
  else if (row.format === "inr") body = <Money value={v} pnl={row.label === "Net P&L" || row.label.startsWith("Avg per")} />;
  else if (row.format === "pct") body = `${v.toFixed(1)}%`;
  else if (row.format === "ratio") body = v.toFixed(2);
  else if (row.format === "r") body = `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
  else body = formatNumber(v);
  return (
    <span className={clsx("inline-flex items-center gap-1", win && "font-semibold")}>
      {win && <Check size={13} className="text-profit" aria-label="better" />}
      {body}
    </span>
  );
}

function SetFields({ prefix, name, filter, swatch }: { prefix: string; name: string; filter: TradeFilter; swatch: string }) {
  const emo = filter.emotions?.join(",") ?? "";
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="flex items-center gap-2 px-1 text-sm font-medium">
        <span className="h-3 w-3 rounded-sm" style={{ background: swatch }} aria-hidden /> Set {prefix[0].toUpperCase()}
      </legend>
      <label className="block">
        <span className="label">Name</span>
        <input name={`${prefix}name`} defaultValue={name} maxLength={40} className="input" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Select label="Plan" name={`${prefix}plan`} value={filter.plan} options={[["followed", "Followed plan"], ["broke", "Broke plan"]]} />
        <Select label="Expiry" name={`${prefix}expiry`} value={filter.expiry} options={[["yes", "Expiry days"], ["no", "Non-expiry days"]]} />
        <label>
          <span className="label">Entry after (IST)</span>
          <input type="time" name={`${prefix}timeFrom`} defaultValue={filter.timeFrom} className="input" />
        </label>
        <label>
          <span className="label">Entry before (IST)</span>
          <input type="time" name={`${prefix}timeTo`} defaultValue={filter.timeTo} className="input" />
        </label>
        <Select
          label="Emotion before"
          name={`${prefix}emotions`}
          value={emo || undefined}
          options={[["Calm,Confident", "Calm or confident"], ["Revenge,FOMO", "Revenge or FOMO"], ...EMOTIONS.map((e) => [e, e] as [string, string])]}
        />
        <Select label="Stop-loss" name={`${prefix}stopLoss`} value={filter.stopLoss} options={[["yes", "Had a stop-loss"], ["no", "No stop-loss"]]} />
        <Select label="Direction" name={`${prefix}direction`} value={filter.direction} options={[["LONG", "Long"], ["SHORT", "Short"]]} />
      </div>
    </fieldset>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value?: string; options: [string, string][] }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input">
        <option value="">Any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
