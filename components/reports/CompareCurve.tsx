"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";
import { useAnimateCharts } from "@/lib/use-motion";

type Point = { n: number; a: number | null; b: number | null };

/**
 * Two cumulative P&L lines on one shared axis (same unit, ₹), x = trade number so
 * sets of different sizes line up. Legend is always shown (2 series) and the
 * tooltip names each series, so identity never relies on colour alone.
 */
export function CompareCurve({ data, nameA, nameB }: { data: Point[]; nameA: string; nameB: string }) {
  const animate = useAnimateCharts();
  if (data.length < 2) return <p className="py-10 text-center text-sm text-muted">Not enough trades to draw curves.</p>;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-a)]" /> A · {nameA}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-b)]" /> B · {nameB}</span>
      </div>
      <div className="money-chart h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="n" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => formatINRCompact(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
            <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return (
                  <div className="tabular rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                    <div className="mb-1 font-medium">After trade {p.n}</div>
                    {p.a != null && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted"><span className="h-0.5 w-3 rounded bg-[var(--series-a)]" />A</span>
                        <span>{formatINR(p.a, { signed: true })}</span>
                      </div>
                    )}
                    {p.b != null && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 text-muted"><span className="h-0.5 w-3 rounded bg-[var(--series-b)]" />B</span>
                        <span>{formatINR(p.b, { signed: true })}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="a" name={nameA} stroke="var(--series-a)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={animate} animationDuration={1200} animationEasing="ease-out" activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="b" name={nameB} stroke="var(--series-b)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={animate} animationDuration={1200} animationEasing="ease-out" activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
