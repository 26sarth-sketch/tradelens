import "server-only";
// Import pipeline shared by every broker format:
//   parse → drop fills already in the DB → group into round trips → preview → save.
// Preview and save both re-run the pipeline from the raw CSV, so nothing is held
// between the two steps.

import type { BrokeragePlanKey } from "@/config/market";
import { db } from "../db";
import { buildTradeData } from "../trades";
import type { ImportSource, Segment } from "../types";
import { groupRoundTrips, toRawTrade } from "./roundtrip";
import type { Fill, ParseIssue, ParseResult } from "./types";

export type PreviewTrade = {
  symbol: string;
  segment: Segment;
  direction: string;
  qty: number;
  avgEntry: number;
  avgExit: number;
  entryAt: string;
  exitAt: string;
  grossPnl: number;
  totalCharges: number;
  netPnl: number;
};

export type ImportPreview = {
  rowCount: number;
  fillCount: number;
  duplicateFills: number;
  issues: ParseIssue[];
  open: { symbol: string; netQty: number }[];
  trades: PreviewTrade[];
  totals: { gross: number; charges: number; net: number };
};

/** Ids already stored. Split fills are saved as "<id>#2", so strip the suffix. */
async function existingIds(fills: Fill[]): Promise<Set<string>> {
  const ids = fills.map((f) => f.brokerTradeId).filter((x): x is string => Boolean(x));
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = await db.execution.findMany({
      where: { OR: [{ brokerTradeId: { in: chunk } }, ...chunk.map((id) => ({ brokerTradeId: { startsWith: `${id}#` } }))] },
      select: { brokerTradeId: true },
    });
    rows.forEach((r) => r.brokerTradeId && found.add(r.brokerTradeId.split("#")[0]));
  }
  return found;
}

async function prepare(parsed: ParseResult, plan?: BrokeragePlanKey) {
  const seen = await existingIds(parsed.fills);
  const fresh = parsed.fills.filter((f) => !f.brokerTradeId || !seen.has(f.brokerTradeId));
  const { trades, open } = groupRoundTrips(fresh);
  const built = trades.map((rt) => ({ rt, data: buildTradeData(toRawTrade(rt), plan) }));
  return { fresh, built, open, duplicateFills: parsed.fills.length - fresh.length };
}

export async function previewImport(parsed: ParseResult, plan?: BrokeragePlanKey): Promise<ImportPreview> {
  const { fresh, built, open, duplicateFills } = await prepare(parsed, plan);
  const sum = (k: "grossPnl" | "totalCharges" | "netPnl") => built.reduce((s, b) => s + b.data[k], 0);
  return {
    rowCount: parsed.rowCount,
    fillCount: fresh.length,
    duplicateFills,
    issues: parsed.issues,
    open: open.map((o) => ({ symbol: o.rawSymbol, netQty: o.netQty })),
    trades: built.map(({ data }) => ({
      symbol: data.symbol,
      segment: data.segment,
      direction: data.direction,
      qty: data.qty,
      avgEntry: data.avgEntry,
      avgExit: data.avgExit,
      entryAt: data.entryAt.toISOString(),
      exitAt: data.exitAt.toISOString(),
      grossPnl: data.grossPnl,
      totalCharges: data.totalCharges,
      netPnl: data.netPnl,
    })),
    totals: { gross: sum("grossPnl"), charges: sum("totalCharges"), net: sum("netPnl") },
  };
}

/** Saves the batch, its trades and their executions in one transaction. */
export async function commitImport(opts: {
  userId: string;
  source: ImportSource;
  filename?: string;
  columnMap?: Record<string, string>;
  parsed: ParseResult;
  plan?: BrokeragePlanKey;
}) {
  const { built } = await prepare(opts.parsed, opts.plan);

  return db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userId: opts.userId,
        source: opts.source,
        filename: opts.filename,
        columnMap: opts.columnMap ? JSON.stringify(opts.columnMap) : null,
        rowCount: opts.parsed.rowCount,
        tradeCount: built.length,
      },
    });
    for (const { rt, data } of built) {
      await tx.trade.create({
        data: {
          ...data,
          userId: opts.userId,
          source: opts.source,
          batchId: batch.id,
          executions: {
            create: rt.parts.map((p) => ({
              batchId: batch.id,
              symbol: p.rawSymbol,
              side: p.side,
              qty: p.partQty,
              price: p.price,
              executedAt: p.executedAt,
              exchange: p.exchange,
              orderId: p.orderId,
              brokerTradeId: p.partId,
            })),
          },
        },
      });
    }
    return batch;
  }, { timeout: 60_000 }); // large tradebooks take a while on SQLite
}
