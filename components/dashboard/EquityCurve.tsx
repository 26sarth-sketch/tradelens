"use client";

import clsx from "clsx";
import { useAnimateCharts } from "@/lib/use-motion";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatView } from "@/components/ui/ViewValue";
import { formatINRCompact, formatNumber, pnlClass } from "@/lib/format";
import type { EquityPoint, View } from "@/lib/stats";

const ACCENT = "var(--accent)";

function shortDate(key: string) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/** Short axis labels; the card title already names the unit. */
function axisValue(view: View, v: number) {
  if (view === "inr") return formatINRCompact(v);
  if (view === "points") return formatNumber(v);
  if (view === "r") return `${v}R`;
  return `${v}%`;
}

/** Single-series cumulative curve: one accent line, soft fill, zero baseline, crosshair tooltip. */
export function EquityCurve({ data, view }: { data: EquityPoint[]; view: View }) {
  const animate = useAnimateCharts();
  if (data.length < 2) {
    return <p className="py-16 text-center text-sm text-muted">Not enough trading days to draw a curve yet.</p>;
  }
  return (
    // In ₹ view, axis labels and tooltip blur in privacy mode (see globals.css).
    <div className={clsx("h-64 w-full", view === "inr" && "money-chart")}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tickFormatter={(v: number) => axisValue(view, v)}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.5} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as EquityPoint;
              return (
                <div className="tabular rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                  <div className="mb-1 font-medium">{shortDate(p.date)}</div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">Cumulative</span>
                    <span className={pnlClass(p.cumulative)}>{formatView(view, p.cumulative, { signed: true })}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted">That day</span>
                    <span className={pnlClass(p.value)}>{formatView(view, p.value, { signed: true })}</span>
                  </div>
                  {p.drawdown < 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Below peak</span>
                      <span className="text-loss">{formatView(view, p.drawdown)}</span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#equityFill)"
            activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={animate} animationDuration={1200} animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
