import Link from "next/link";
import type { TradeFilter } from "@/lib/filters";
import { SEGMENT_LABELS, SEGMENTS } from "@/lib/types";

/**
 * The global filter bar shared by every report: date range, segment, strategy, tag.
 * A plain GET form: filters live in the URL, survive tab switches and are shareable.
 * `keep` carries other params (tab, bucket) through submits.
 */
export function FilterBar({
  action,
  filter,
  strategies,
  tags,
  keep = {},
}: {
  action: string;
  filter: TradeFilter;
  strategies: { id: string; name: string }[];
  tags: string[];
  keep?: Record<string, string | undefined>;
}) {
  const clearHref = (() => {
    const p = new URLSearchParams(Object.entries(keep).filter(([, v]) => v) as [string, string][]);
    const q = p.toString();
    return q ? `${action}?${q}` : action;
  })();
  const active = Boolean(filter.from || filter.to || filter.segment || filter.strategyId || filter.tag);

  return (
    <form action={action} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-6">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label>
        <span className="label">From</span>
        <input type="date" name="from" defaultValue={filter.from} className="input" />
      </label>
      <label>
        <span className="label">To</span>
        <input type="date" name="to" defaultValue={filter.to} className="input" />
      </label>
      <label>
        <span className="label">Segment</span>
        <select name="segment" defaultValue={filter.segment ?? ""} className="input">
          <option value="">All segments</option>
          {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Strategy</span>
        <select name="strategyId" defaultValue={filter.strategyId ?? ""} className="input">
          <option value="">All strategies</option>
          {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="none">No strategy</option>
        </select>
      </label>
      <label>
        <span className="label">Tag</span>
        <select name="tag" defaultValue={filter.tag ?? ""} className="input">
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="none">Untagged</option>
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button className="btn-primary flex-1">Apply</button>
        {active && <Link href={clearHref} className="btn-ghost">Clear</Link>}
      </div>
    </form>
  );
}
