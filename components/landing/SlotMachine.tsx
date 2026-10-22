"use client";

// "Lucky Ledger": a play-money slot machine whose symbols are a trader's habits. Each symbol
// reveals a real reading from the demo journal (computed on the server and passed in).
// Pull the lever, tap the button, or press SPACE while it is on screen.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGame } from "./GameProvider";

export type SymbolKey = "spade" | "heart" | "diamond" | "club" | "seven" | "rupee";
export type Reading = { title: string; headline: string; detail: string; tone: "good" | "bad" | "warn" };

const SYMBOLS: Record<SymbolKey, { glyph: string; color: string }> = {
  spade: { glyph: "♠", color: "#14171f" },
  heart: { glyph: "♥", color: "#e11d48" },
  diamond: { glyph: "♦", color: "#e11d48" },
  club: { glyph: "♣", color: "#14171f" },
  seven: { glyph: "7", color: "#d97706" },
  rupee: { glyph: "₹", color: "#0f766e" },
};
const KEYS = Object.keys(SYMBOLS) as SymbolKey[];
const CELL = 92;
const TONE = { good: "mint", bad: "ruby", warn: "gold" } as const;

const pick = (): SymbolKey => KEYS[Math.floor(Math.random() * KEYS.length)];

function Reel({ strip, spinId, duration }: { strip: SymbolKey[]; spinId: number; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || spinId === 0) return;
    el.style.transition = "none";
    el.style.transform = "translateY(0)";
    void el.offsetHeight; // restart from the top, then roll down to the final symbol
    el.style.transition = duration ? `transform ${duration}ms cubic-bezier(0.15, 0.7, 0.25, 1)` : "none";
    el.style.transform = `translateY(-${(strip.length - 1) * CELL}px)`;
  }, [spinId, strip, duration]);
  return (
    <div className="reel-window">
      <div ref={ref}>
        {strip.map((k, i) => (
          <div key={i} className="reel-cell" style={{ color: SYMBOLS[k].color }} aria-hidden>
            {SYMBOLS[k].glyph}
          </div>
        ))}
      </div>
    </div>
  );
}

type Result = { hand: SymbolKey[]; kind: "none" | "pair" | "triple"; won: number };

export function SlotMachine({ readings }: { readings: Record<SymbolKey, Reading> }) {
  const { addChips, unlock } = useGame();
  const [strips, setStrips] = useState<SymbolKey[][]>([["spade"], ["rupee"], ["seven"]]);
  const [durations, setDurations] = useState([0, 0, 0]);
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useRef(false);

  const spin = useCallback(() => {
    if (spinning) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hand = [pick(), pick(), pick()];
    setStrips(strips.map((s, i) => [s[s.length - 1], ...Array.from({ length: 12 + i * 4 }, pick), hand[i]]));
    setDurations([0, 1, 2].map((i) => (reduce ? 0 : 1000 + i * 450)));
    setSpinId((n) => n + 1);
    setSpinning(true);
    setResult(null);
    const wait = reduce ? 0 : 1000 + 2 * 450 + 120;
    timer.current = setTimeout(() => {
      const distinct = new Set(hand).size;
      const kind = distinct === 1 ? "triple" : distinct === 2 ? "pair" : "none";
      const won = kind === "triple" ? 250 : kind === "pair" ? 50 : 10;
      addChips(won);
      unlock("first-pull");
      if (kind !== "none") unlock("pair");
      if (kind === "triple") unlock("jackpot");
      setResult({ hand, kind, won });
      setSpinning(false);
    }, wait);
  }, [spinning, strips, addChips, unlock]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; }, { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !inView.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      spin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spin]);

  const shown = result ? [...new Set(result.hand)] : [];

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-md">
      <div className={`bulbs bg-black/60 p-3 ${spinning ? "glow-pulse" : ""}`}>
        <div className="rounded-[18px] bg-gradient-to-b from-[#1b1f2a] to-[#0b0d13] p-4 ring-1 ring-white/10">
          <div className="mb-3 text-center">
            <div className="arcade text-[9px] uppercase tracking-widest text-white/60">TradeLens presents</div>
            <div className="sign neon-gold text-2xl leading-7">Lucky Ledger</div>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-2xl bg-gradient-to-b from-[#7a5a12] via-[color:var(--c-gold)] to-[#7a5a12] p-2 shadow-[0_0_0_2px_rgba(0,0,0,0.5)]">
              <div className="relative grid grid-cols-3 gap-2 rounded-xl bg-black p-2">
                {strips.map((s, i) => (
                  <Reel key={i} strip={s} spinId={spinId} duration={durations[i]} />
                ))}
                {/* payline through the middle of the reels */}
                <div className="pointer-events-none absolute inset-x-1 top-[54px] h-[2px] bg-[color:var(--c-ruby)]/60" aria-hidden />
              </div>
            </div>
            <button
              type="button"
              onClick={spin}
              disabled={spinning}
              aria-label="Pull the lever"
              className="flex w-12 flex-col items-center justify-start pt-5 outline-offset-4"
            >
              <span className={`lever ${spinning ? "pulled" : ""}`} />
            </button>
          </div>

          <button type="button" onClick={spin} disabled={spinning} className="btn-gold arcade mt-4 w-full text-xs">
            {spinning ? "SPINNING…" : result ? "PULL AGAIN" : "PULL THE LEVER"}
          </button>
          <p className="arcade mt-3 text-center text-[8px] leading-4 text-white/55">SPACE OR TAP TO PULL · PLAY CHIPS ONLY</p>
        </div>
      </div>

      {/* Reading panel */}
      <div className={`panel mt-4 p-4 ${result?.kind === "triple" ? "jackpot" : ""}`} aria-live="polite">
        {!result ? (
          <p className="text-sm text-white/70">
            {spinning ? "Dealing the demo trader's last 60 days…" : "The demo trader's last 60 days, face-down. Pull the lever to flip a few cards from the journal."}
          </p>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="arcade text-[10px] uppercase leading-4 gold">
                {result.kind === "triple" ? "JACKPOT! three of a kind" : result.kind === "pair" ? "Pair! nice hand" : "Your hand"}
              </div>
              <div className="arcade text-[10px] mint">+{result.won} CHIPS</div>
            </div>
            <ul className="space-y-3">
              {shown.map((k) => {
                const r = readings[k];
                return (
                  <li key={k} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--c-ivory)] text-lg font-bold" style={{ color: SYMBOLS[k].color }} aria-hidden>
                      {SYMBOLS[k].glyph}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wide text-white/55">{r.title}</div>
                      <div className={`text-sm font-semibold ${TONE[r.tone]}`}>{r.headline}</div>
                      <div className="text-xs text-white/65">{r.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="mt-3 border-t border-white/10 pt-2 text-[10px] text-white/45">Real numbers from the demo journal. The chips are pretend: no betting, no real money, no tips.</p>
      </div>
    </div>
  );
}
