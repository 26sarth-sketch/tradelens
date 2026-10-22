"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const short = (k: string) => new Date(`${k}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

/** Rolling Lens Score (0–100). Single series; the 50 line marks "Developing". */
export function ScoreTrend({ data }: { data: { date: string; score: number }[] }) {
  if (data.length < 2) return <p className="py-10 text-center text-sm text-muted">Needs at least 21 trading days to show a trend.</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={32} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <ReferenceLine y={50} stroke="var(--muted)" strokeOpacity={0.5} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; score: number };
              return (
                <div className="tabular rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                  <div className="font-medium">{short(p.date)}</div>
                  <div>Score {p.score} <span className="text-muted">(last 20 trading days)</span></div>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
