"use client";

import { useGame } from "./GameProvider";

/** Arcade-style counters in the header: play chips, level and an XP bar that fills as you scroll. */
export function Hud() {
  const { chips, xp, level } = useGame();
  return (
    <>
      <div className="flex items-center gap-2 sm:gap-3" aria-label="Play-money score">
        <div className="rounded-md border border-[color:var(--c-gold)]/40 bg-black/50 px-2 py-1 sm:px-3">
          <div className="arcade text-[8px] leading-3 text-white/60">CHIPS</div>
          <div className="arcade tabular text-[11px] leading-4 gold sm:text-xs">{String(chips).padStart(4, "0")}</div>
        </div>
        <div className="hidden rounded-md border border-[color:var(--c-mint)]/40 bg-black/50 px-3 py-1 sm:block">
          <div className="arcade text-[8px] leading-3 text-white/60">LEVEL</div>
          <div className="arcade text-xs leading-4 mint">{level.name}</div>
        </div>
      </div>
      {/* XP bar along the bottom edge of the header */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10" role="progressbar" aria-label="XP" aria-valuenow={xp} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-gradient-to-r from-[color:var(--c-mint)] via-[color:var(--c-gold)] to-[color:var(--c-ruby)] transition-[width] duration-150" style={{ width: `${xp}%` }} />
      </div>
    </>
  );
}
