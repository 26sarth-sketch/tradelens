// Auto-tagger: finds behaviour patterns in trades and suggests tags, with a reason
// computed from the data. Rule-based on purpose: exact, explainable, works without
// an AI key, and can't invent anything. The trader accepts or dismisses each one.
//
//   Revenge trade        entered ≤ 10 min after a losing exit, same IST day
//   Overtrading          trade number above the day's plan (or the daily trade limit)
//   Held loser too long  loss went ≥ 25% past the stop-loss; or, with no stop-loss,
//                        a loss held ≥ 2× as long as the trader's typical winner
//                        (needs 5+ winners) and bigger than their average loss
//   After cut-off        entered at or after the "no new trades after" time

import { formatINR, istDateKey, istMinutes } from "./format";

export const AUTO_TAGS = {
  REVENGE: "Revenge trade",
  OVERTRADING: "Overtrading",
  HELD_LOSER: "Held loser too long",
  AFTER_CUTOFF: "After cut-off",
} as const;

export const REVENGE_WINDOW_MIN = 10;

export type TagTrade = {
  id: string;
  symbol: string;
  entryAt: Date;
  exitAt: Date;
  netPnl: number;
  direction: string;
  qty: number;
  avgEntry: number;
  avgExit: number;
  plannedSL: number | null;
};

export type TagContext = {
  maxTradesPerDay: number | null;
  noTradeAfter: string | null; // "HH:MM" IST
  /** Max trades from the day's pre-market plan, by IST day key (overrides the standing limit). */
  planMaxTrades?: Record<string, number | null | undefined>;
};

export type TagSuggestion = { tradeId: string; tag: string; reason: string };

const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}

export function suggestTags(trades: TagTrade[], ctx: TagContext): TagSuggestion[] {
  const out: TagSuggestion[] = [];
  const sorted = [...trades].sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime());

  // Per-day rules
  const byDay = new Map<string, TagTrade[]>();
  for (const t of sorted) {
    const k = istDateKey(t.entryAt);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  for (const [day, ts] of byDay) {
    // Revenge: the most recent losing exit before this entry, within the window.
    ts.forEach((t, i) => {
      const priorLoss = ts
        .slice(0, i)
        .filter((p) => p.netPnl < 0 && p.exitAt.getTime() <= t.entryAt.getTime())
        .sort((a, b) => b.exitAt.getTime() - a.exitAt.getTime())[0];
      if (priorLoss) {
        const gap = minutesBetween(priorLoss.exitAt, t.entryAt);
        if (gap <= REVENGE_WINDOW_MIN) {
          out.push({
            tradeId: t.id,
            tag: AUTO_TAGS.REVENGE,
            reason: `Entered ${gap} min after a ${formatINR(priorLoss.netPnl)} loss on ${priorLoss.symbol}.`,
          });
        }
      }
    });

    // Overtrading: beyond the day's plan, else the standing daily limit.
    const limit = ctx.planMaxTrades?.[day] ?? ctx.maxTradesPerDay;
    if (limit != null) {
      ts.slice(limit).forEach((t, i) =>
        out.push({ tradeId: t.id, tag: AUTO_TAGS.OVERTRADING, reason: `Trade #${limit + i + 1} of the day; your limit was ${limit}.` }),
      );
    }

    // After cut-off
    if (ctx.noTradeAfter) {
      const cutoff = Number(ctx.noTradeAfter.slice(0, 2)) * 60 + Number(ctx.noTradeAfter.slice(3, 5));
      for (const t of ts) {
        const m = istMinutes(t.entryAt);
        if (m >= cutoff) out.push({ tradeId: t.id, tag: AUTO_TAGS.AFTER_CUTOFF, reason: `Entered at ${hhmm(m)}; your cut-off is ${ctx.noTradeAfter}.` });
      }
    }
  }

  // Held loser too long
  const winners = sorted.filter((t) => t.netPnl > 0);
  const losers = sorted.filter((t) => t.netPnl <= 0);
  const typicalWinHold = winners.length >= 5 ? median(winners.map((t) => minutesBetween(t.entryAt, t.exitAt))) : null;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + -t.netPnl, 0) / losers.length : 0;
  for (const t of losers) {
    const long = t.direction === "LONG";
    if (t.plannedSL != null) {
      const risk = Math.abs(t.avgEntry - t.plannedSL);
      const actual = long ? t.avgEntry - t.avgExit : t.avgExit - t.avgEntry;
      if (risk > 0 && actual >= risk * 1.25) {
        out.push({
          tradeId: t.id,
          tag: AUTO_TAGS.HELD_LOSER,
          reason: `Exited ${Math.round((actual / risk - 1) * 100)}% beyond your stop-loss (${t.plannedSL}).`,
        });
      }
    } else if (typicalWinHold != null && typicalWinHold > 0) {
      const held = minutesBetween(t.entryAt, t.exitAt);
      if (held >= typicalWinHold * 2 && -t.netPnl > avgLoss) {
        out.push({
          tradeId: t.id,
          tag: AUTO_TAGS.HELD_LOSER,
          reason: `No stop-loss; held a ${formatINR(t.netPnl)} loss for ${held} min (your winners usually last ${Math.round(typicalWinHold)} min).`,
        });
      }
    }
  }
  return out;
}
