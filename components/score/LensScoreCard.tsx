import clsx from "clsx";
import Link from "next/link";
import { InfoTip } from "@/components/ui/InfoTip";
import { SCORE_NAME } from "@/config/brand";
import { type LensScore, MIN_TRADES_FOR_SCORE } from "@/lib/score";
import { LensRadar } from "./LensRadar";

function tone(score: number) {
  return score >= 65 ? "bg-profit" : score >= 45 ? "bg-warn" : "bg-loss";
}

/** Lens Score: big number, grade, radar, and a readable list of the six components. */
export function LensScoreCard({ score, compact = false, scope }: { score: LensScore | null; compact?: boolean; scope?: string }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 arcade text-[10px] uppercase leading-4 tracking-wide text-muted">
          {SCORE_NAME}
          <InfoTip learnHref="/learn/lens-score">
            <span className="block font-medium">How is this calculated?</span>
            Six parts, each scored 0–100, then a weighted average: win rate (15%), profit factor (20%), average win vs loss
            (15%), drawdown control (15%), consistency of green days (15%) and plan adherence (20%: trades that followed your
            plan plus days with no risk-rule breach). Hover the chart for each part&apos;s scale.
          </InfoTip>
        </h2>
        {!compact && <Link href="/progress" className="text-xs text-accent hover:underline">Progress →</Link>}
      </div>

      {!score ? (
        <p className="py-8 text-center text-sm text-muted">Needs at least {MIN_TRADES_FOR_SCORE} trades in this range.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-semibold">{score.total}</span>
            <span className="text-sm text-muted">/ 100 · {score.grade}</span>
          </div>
          {scope && <p className="text-xs text-muted">{scope}</p>}
          <LensRadar components={score.components} />
          <ul className="space-y-1.5 text-xs">
            {score.components.map((c) => (
              <li key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                <span className="flex items-center justify-between gap-2">
                  <span>{c.label}</span>
                  <span className="truncate text-muted">{c.raw}</span>
                </span>
                <span className="tabular w-8 text-right font-medium">{c.score}</span>
                <span className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className={clsx("block h-full rounded-full", tone(c.score))} style={{ width: `${c.score}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
