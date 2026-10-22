"use client";

import { useState } from "react";
import { useGame } from "./GameProvider";

export type TellCard = {
  rank: string;
  suit: "♠" | "♥" | "♦" | "♣";
  kicker: string;
  big: string;
  small: string;
  fix: string;
  tone: "red" | "black";
};

/** Playing cards showing three findings from the demo journal. Tap or hover to flip to the fix. */
export function FlipCards({ cards }: { cards: TellCard[] }) {
  const { unlock } = useGame();
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  const set = (i: number, v: boolean) => {
    setFlipped((f) => ({ ...f, [i]: v }));
    if (v) unlock("tells");
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {cards.map((c, i) => {
        const suit = c.tone === "red" ? "#e11d48" : "#14171f";
        return (
          <button
            key={c.kicker}
            type="button"
            onClick={() => set(i, !flipped[i])}
            onMouseEnter={() => set(i, true)}
            onMouseLeave={() => setFlipped((f) => ({ ...f, [i]: false }))}
            aria-pressed={!!flipped[i]}
            aria-label={`${c.kicker}. ${c.big}. Tap to ${flipped[i] ? "see the finding" : "see how to fix it"}.`}
            className={`flip block text-left outline-offset-4 ${flipped[i] ? "is-flipped" : ""}`}
          >
            <div className="flip-inner min-h-[290px]">
              <div className="flip-face card-ivory flex min-h-[290px] flex-col p-5">
                <div className="flex items-start justify-between" style={{ color: suit }}>
                  <div className="sign text-3xl leading-8">{c.rank}<div className="text-2xl">{c.suit}</div></div>
                  <div className="arcade text-right text-[9px] leading-4 text-[color:var(--c-ink)]/60">{c.kicker}</div>
                </div>
                <div className="my-auto py-4">
                  <div className="sign text-3xl leading-9" style={{ color: suit }}>{c.big}</div>
                  <p className="mt-2 text-sm text-[color:var(--c-ink)]/75">{c.small}</p>
                </div>
                <div className="arcade text-[8px] leading-4 text-[color:var(--c-ink)]/45">TAP OR HOVER TO FLIP</div>
              </div>
              <div className="flip-face flip-back card-back flex flex-col justify-between p-5" aria-hidden={!flipped[i]}>
                <div className="arcade text-[9px] leading-4 text-white/70">THE FIX · {c.kicker}</div>
                <p className="text-base font-medium leading-6">{c.fix}</p>
                <div className="sign text-4xl leading-9 text-white/30">{c.suit}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
