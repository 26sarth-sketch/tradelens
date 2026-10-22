"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";

export type BarDatum = { label: string; value: number; count: number; winRate: number };

/** Rect with a 4px rounded end on the side away from zero (the data end). */
function RoundedEndBar(props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string; payload?: BarDatum; horizontal: boolean;
}) {
  let { x = 0, y = 0, width = 0, height = 0 } = props;
  if (height < 0) { y += height; height = -height; }
  if (width < 0) { x += width; width = -width; }
  const positive = (props.payload?.value ?? 0) >= 0;
  const r = Math.min(4, props.horizontal ? width / 2 : height / 2, props.horizontal ? height / 2 : width / 2);
  let d: string;
  if (!props.horizontal) {
    d = positive
      ? `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
      : `M${x},${y} V${y + height - r} Q${x},${y + height} ${x + r},${y + height} H${x + width - r} Q${x + width},${y + height} ${x + width},${y + height - r} V${y} Z`;
  } else {
    d = positive
      ? `M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`
      : `M${x + width},${y} H${x + r} Q${x},${y} ${x},${y + r} V${y + height - r} Q${x},${y + height} ${x + r},${y + height} H${x + width} Z`;
  }
  return <path d={d} fill={props.fill} />;
}

/**
 * Net P&L per group. Columns for ordered groups (days, time buckets), horizontal
 * bars for named groups (symbols, tags) so long labels stay readable.
 * Colour = profit/loss; the tooltip always states the signed value too.
 */
export function GroupBarChart({ data, horizontal = false }: { data: BarDatum[]; horizontal?: boolean }) {
  const height = horizontal ? Math.max(160, data.length * 34 + 40) : 260;
  const valueAxis = {
    tickFormatter: (v: number) => formatINRCompact(v),
    tick: { fill: "var(--muted)", fontSize: 11 },
    axisLine: false,
    tickLine: false,
  };
  const categoryAxis = {
    dataKey: "label",
    tick: { fill: "var(--muted)", fontSize: 11 },
    axisLine: false,
    tickLine: false,
    interval: 0 as const,
  };

  return (
    <div className={horizontal ? "money-chart money-chart-x w-full" : "money-chart w-full"} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : 0 }}
          barCategoryGap={horizontal ? 6 : "22%"}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" {...valueAxis} />
              <YAxis type="category" {...categoryAxis} width={130} />
            </>
          ) : (
            <>
              <XAxis {...categoryAxis} angle={data.length > 8 ? -35 : 0} textAnchor={data.length > 8 ? "end" : "middle"} height={data.length > 8 ? 56 : 30} />
              <YAxis {...valueAxis} width={64} />
            </>
          )}
          {horizontal ? <ReferenceLine x={0} stroke="var(--muted)" strokeOpacity={0.6} /> : <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.6} />}
          <Tooltip
            cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as BarDatum;
              return (
                <div className="tabular rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                  <div className="mb-1 font-medium">{d.label}</div>
                  <div className="flex justify-between gap-4"><span className="text-muted">Net P&amp;L</span><span>{formatINR(d.value, { signed: true })}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted">Trades</span><span>{d.count}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted">Win rate</span><span>{d.winRate.toFixed(0)}%</span></div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" isAnimationActive={false} shape={(p: object) => <RoundedEndBar {...p} horizontal={horizontal} />}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.value >= 0 ? "var(--profit)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
