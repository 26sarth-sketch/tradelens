"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True unless the visitor asked for reduced motion. Recharts animates in JS, so CSS alone can't switch it off. */
export function useAnimateCharts(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => !window.matchMedia(QUERY).matches,
    () => true,
  );
}
