"use client";

// Play-money game state for the landing page: chips, XP (scroll + achievements) and unlocked achievements.
// Lives in memory only. No real money, no storage, nothing sent anywhere.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type AchievementId = "first-pull" | "pair" | "jackpot" | "tells" | "dealer" | "rules" | "chips";

export const ACHIEVEMENTS: Record<AchievementId, { title: string; blurb: string; reward: number }> = {
  "first-pull": { title: "First Pull", blurb: "Pull the lever once.", reward: 25 },
  pair: { title: "Pair Up", blurb: "Land two matching symbols.", reward: 50 },
  jackpot: { title: "Jackpot", blurb: "Land three matching symbols.", reward: 250 },
  tells: { title: "Reads the Tells", blurb: "Flip a card to see how to fix it.", reward: 40 },
  dealer: { title: "Meets the Dealer", blurb: "Scroll to the AI coach.", reward: 40 },
  rules: { title: "Knows the House Rules", blurb: "Read what TradeLens won't pretend.", reward: 50 },
  chips: { title: "Checks the Chips", blurb: "Look at the pricing table.", reward: 30 },
};

const LEVELS = [
  { at: 0, name: "Penny Slots" },
  { at: 20, name: "Low Stakes" },
  { at: 45, name: "Mid Stakes" },
  { at: 70, name: "High Stakes" },
  { at: 95, name: "The House" },
];

type Ctx = {
  chips: number;
  xp: number;
  level: { name: string; index: number };
  unlocked: ReadonlySet<AchievementId>;
  addChips: (n: number) => void;
  unlock: (id: AchievementId) => void;
};

const GameCtx = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame must be used inside <GameProvider>");
  return c;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [chips, setChips] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [unlocked, setUnlocked] = useState<ReadonlySet<AchievementId>>(new Set());
  const [toast, setToast] = useState<{ id: AchievementId; n: number } | null>(null);
  const seen = useRef(new Set<AchievementId>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toasts = useRef(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScroll(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const addChips = useCallback((n: number) => setChips((c) => c + n), []);

  const unlock = useCallback((id: AchievementId) => {
    if (seen.current.has(id)) return;
    seen.current.add(id);
    setUnlocked(new Set(seen.current));
    setChips((c) => c + ACHIEVEMENTS[id].reward);
    toasts.current += 1;
    setToast({ id, n: toasts.current });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const xp = Math.min(100, Math.round(scroll * 70 + unlocked.size * 5));
  const levelIndex = LEVELS.reduce((acc, l, i) => (xp >= l.at ? i : acc), 0);

  const value = useMemo<Ctx>(
    () => ({ chips, xp, level: { name: LEVELS[levelIndex].name, index: levelIndex }, unlocked, addChips, unlock }),
    [chips, xp, levelIndex, unlocked, addChips, unlock],
  );

  return (
    <GameCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4" aria-live="polite">
        {toast && (
          <div key={toast.n} className="toast panel-gold flex items-center gap-3 px-4 py-3 shadow-2xl">
            <span className="text-2xl" aria-hidden>🏆</span>
            <div>
              <div className="arcade text-[10px] uppercase leading-4 gold">Achievement unlocked</div>
              <div className="text-sm font-semibold">{ACHIEVEMENTS[toast.id].title} <span className="gold">+{ACHIEVEMENTS[toast.id].reward} chips</span></div>
            </div>
          </div>
        )}
      </div>
    </GameCtx.Provider>
  );
}

/** Unlocks an achievement when this block is mostly on screen. */
export function Watch({ id, children, className, ...rest }: { id: AchievementId; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  const { unlock } = useGame();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          unlock(id);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, unlock]);
  return (
    <section ref={ref} className={className} {...rest}>
      {children}
    </section>
  );
}
