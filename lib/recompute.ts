import "server-only";
import type { BrokeragePlanKey } from "@/config/market";
import { computeTradePnl } from "./charges";
import { db } from "./db";
import { computeR } from "./trades";
import type { Direction, Exchange, Segment } from "./types";

/**
 * Re-runs the charges engine on every stored trade, e.g. after rates in
 * config/market.ts change or the trader switches brokerage plan. R is recomputed
 * too because it uses net P&L.
 */
export async function recomputeAllCharges(userId: string, plan: BrokeragePlanKey): Promise<number> {
  const trades = await db.trade.findMany({ where: { userId } });
  const updates = trades.map((t) => {
    const pnl = computeTradePnl({
      exchange: t.exchange as Exchange,
      segment: t.segment as Segment,
      direction: t.direction as Direction,
      qty: t.qty,
      avgEntry: t.avgEntry,
      avgExit: t.avgExit,
      buyOrders: t.buyOrders,
      sellOrders: t.sellOrders,
      plan,
    });
    const r = computeR({ avgEntry: t.avgEntry, qty: t.qty, plannedSL: t.plannedSL, plannedTarget: t.plannedTarget }, pnl.netPnl);
    return db.trade.update({
      where: { id: t.id },
      data: {
        grossPnl: pnl.grossPnl,
        brokerage: pnl.brokerage,
        stt: pnl.stt,
        exchangeTxn: pnl.exchangeTxn,
        sebiFee: pnl.sebiFee,
        stampDuty: pnl.stampDuty,
        gst: pnl.gst,
        otherCharges: pnl.otherCharges,
        totalCharges: pnl.totalCharges,
        netPnl: pnl.netPnl,
        points: pnl.points,
        plannedR: r.plannedR,
        rMultiple: r.rMultiple,
      },
    });
  });
  await db.$transaction(updates);
  return trades.length;
}
