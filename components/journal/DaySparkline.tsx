/**
 * Tiny cumulative-P&L line for one day (trade by trade). Decorative summary only;
 * the card prints the actual numbers, so it's aria-hidden.
 */
export function DaySparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 1) return null;
  const pts = [0, ...values.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], [])];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i: number) => (i / (pts.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4);
  const final = pts.at(-1)!;
  const color = final > 0 ? "var(--profit)" : final < 0 ? "var(--loss)" : "var(--muted)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <line x1={2} x2={width - 2} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="2 3" />
      <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(final)} r={2.5} fill={color} />
    </svg>
  );
}
