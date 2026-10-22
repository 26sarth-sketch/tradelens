// Tiny in-memory sliding-window rate limiter. On serverless each instance has its own memory, so
// this is a brake against casual abuse of the public demo, not a hard guarantee.

export type Limiter = { allow: (key: string, now: number) => boolean };

export function createLimiter(opts: { max: number; windowMs: number; maxKeys?: number }): Limiter {
  const hits = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 2000;
  return {
    allow(key, now) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) {
        // Forget the oldest keys so memory stays bounded.
        for (const k of hits.keys()) {
          hits.delete(k);
          if (hits.size <= maxKeys / 2) break;
        }
      }
      return true;
    },
  };
}
