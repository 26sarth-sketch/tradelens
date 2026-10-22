"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ScoreComponent } from "@/lib/score";
import { useAnimateCharts } from "@/lib/use-motion";

/** Six-axis radar of the Lens Score components (0–100). Single series, so no legend. */
export function LensRadar({ components }: { components: ScoreComponent[] }) {
  const animate = useAnimateCharts();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={components} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const c = payload[0].payload as ScoreComponent;
              return (
                <div className="tabular rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
                  <div className="font-medium">{c.label}: {c.score}/100</div>
                  <div className="text-muted">{c.raw}</div>
                  <div className="text-muted">Scale: {c.rule} · weight {Math.round(c.weight * 100)}%</div>
                </div>
              );
            }}
          />
          <Radar dataKey="score" stroke="var(--accent)" strokeWidth={2} fill="var(--accent)" fillOpacity={0.22} dot={{ r: 3, fill: "var(--accent)" }} isAnimationActive={animate} animationDuration={900} animationEasing="ease-out" />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
