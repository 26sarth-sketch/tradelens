"use client";

import { Lock, Trophy } from "lucide-react";
import { ACHIEVEMENTS, type AchievementId, useGame } from "./GameProvider";

/** Trophy shelf: lights up as the visitor plays with the page. Session-only, nothing is stored. */
export function Trophies() {
  const { unlocked, chips, level, xp } = useGame();
  const ids = Object.keys(ACHIEVEMENTS) as AchievementId[];
  return (
    <div className="panel-gold p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="arcade text-[10px] uppercase leading-4 gold">Your session</div>
          <div className="sign text-xl leading-7">{level.name} <span className="text-white/40">· {xp} XP</span></div>
        </div>
        <div className="arcade tabular rounded-md border border-[color:var(--c-gold)]/40 bg-black/50 px-3 py-2 text-xs gold">{String(chips).padStart(4, "0")} CHIPS</div>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ids.map((id) => {
          const a = ACHIEVEMENTS[id];
          const on = unlocked.has(id);
          return (
            <li key={id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? "border-[color:var(--c-gold)]/50 bg-[color:var(--c-gold)]/10" : "border-white/10 bg-white/[0.03]"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-[color:var(--c-gold)] text-[#2a1a00]" : "bg-white/10 text-white/40"}`}>
                {on ? <Trophy size={18} /> : <Lock size={16} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${on ? "" : "text-white/60"}`}>{a.title}</span>
                <span className="block text-xs text-white/55">{a.blurb} <span className="gold">+{a.reward}</span></span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-white/45">{unlocked.size} of {ids.length} unlocked. Pull the lever, flip the cards and scroll to earn the rest. Play chips only.</p>
    </div>
  );
}
