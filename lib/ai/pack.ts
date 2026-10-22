// Compact, rounded stat packs for AI context. Shared by context.ts (server) and the
// pure journal-query engine; the number verifier matches model output against these.

import type { Stats } from "../stats";

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function packStats(s: Stats) {
  return {
    trades: s.count,
    win_rate_pct: r1(s.winRate),
    net_pnl_inr: r0(s.net),
    gross_pnl_inr: r0(s.grossPnl),
    charges_inr: r0(s.totalCharges),
    charges_pct_of_gross_profit: s.chargesPctOfGross == null ? null : r1(s.chargesPctOfGross),
    profit_factor: s.profitFactor == null ? null : r2(s.profitFactor),
    avg_win_inr: r0(s.avgWin),
    avg_loss_inr: r0(s.avgLoss),
    expectancy_per_trade_inr: r0(s.expectancy),
    max_drawdown_inr: r0(s.maxDrawdown),
  };
}
