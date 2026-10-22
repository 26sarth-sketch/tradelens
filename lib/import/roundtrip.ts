// Groups broker fills into complete round-trip trades.
//
// Per instrument, fills are walked in time order while tracking the net position.
// A trade opens when the position leaves 0 and closes when it returns to 0, so
// scale-ins and partial exits stay inside one trade. A fill that flips the position
// (e.g. long 65 → sell 130) is split: one part closes the trade, the rest opens a new one.
// Positions still open at the end of the file are reported, not imported.
//
// Equity round trips that open and close on the same IST day are intraday; anything
// held overnight is delivery (tradebooks don't say MIS vs CNC).

import { round2 } from "../charges";
import { lotSizeFor } from "../expiry";
import { istDateKey } from "../format";
import type { RawTrade } from "../trades";
import type { Direction, Segment } from "../types";
import type { Fill, Instrument } from "./types";

/** A fill, or the part of a fill that belongs to one trade. */
export type FillPart = Fill & { partQty: number; partId?: string };

export type RoundTrip = {
  instrument: Instrument;
  exchange: Fill["exchange"];
  direction: Direction;
  qty: number;
  avgEntry: number;
  avgExit: number;
  entryAt: Date;
  exitAt: Date;
  buyOrders: number;
  sellOrders: number;
  parts: FillPart[];
};

export type OpenPosition = { instrument: Instrument; rawSymbol: string; netQty: number; parts: FillPart[] };

type Building = {
  direction: Direction;
  entryQty: number;
  entryValue: number;
  exitQty: number;
  exitValue: number;
  parts: FillPart[];
};

function countOrders(parts: FillPart[], side: "BUY" | "SELL") {
  const ofSide = parts.filter((p) => p.side === side);
  const ids = new Set(ofSide.map((p) => p.orderId).filter(Boolean));
  // Without order ids, treat each fill as its own order.
  return ids.size > 0 ? ids.size : ofSide.length;
}

function finish(b: Building, instrument: Instrument): RoundTrip {
  const times = b.parts.map((p) => p.executedAt.getTime());
  return {
    instrument,
    exchange: b.parts[0].exchange,
    direction: b.direction,
    qty: b.entryQty,
    avgEntry: round2(b.entryValue / b.entryQty),
    avgExit: round2(b.exitValue / b.exitQty),
    entryAt: new Date(Math.min(...times)),
    exitAt: new Date(Math.max(...times)),
    buyOrders: countOrders(b.parts, "BUY"),
    sellOrders: countOrders(b.parts, "SELL"),
    parts: b.parts,
  };
}

export function groupRoundTrips(fills: Fill[]): { trades: RoundTrip[]; open: OpenPosition[] } {
  const byInstrument = new Map<string, Fill[]>();
  for (const f of fills) {
    const list = byInstrument.get(f.instrument.key) ?? [];
    list.push(f);
    byInstrument.set(f.instrument.key, list);
  }

  const trades: RoundTrip[] = [];
  const open: OpenPosition[] = [];

  for (const list of byInstrument.values()) {
    list.sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime() || a.row - b.row);
    const instrument = list[0].instrument;
    let pos = 0; // signed: + long, - short
    let cur: Building | null = null;

    for (const f of list) {
      const sign = f.side === "BUY" ? 1 : -1;
      let remaining = f.qty;
      let partNo = 0;

      while (remaining > 1e-9) {
        const partId = f.brokerTradeId ? (partNo === 0 ? f.brokerTradeId : `${f.brokerTradeId}#${partNo + 1}`) : undefined;
        partNo++;

        if (pos === 0 || Math.sign(pos) === sign) {
          // Opening or adding to the position.
          cur ??= { direction: sign > 0 ? "LONG" : "SHORT", entryQty: 0, entryValue: 0, exitQty: 0, exitValue: 0, parts: [] };
          cur.entryQty += remaining;
          cur.entryValue += remaining * f.price;
          cur.parts.push({ ...f, partQty: remaining, partId });
          pos += sign * remaining;
          remaining = 0;
        } else {
          // Reducing / closing the position.
          const closeQty = Math.min(remaining, Math.abs(pos));
          cur!.exitQty += closeQty;
          cur!.exitValue += closeQty * f.price;
          cur!.parts.push({ ...f, partQty: closeQty, partId });
          pos += sign * closeQty;
          remaining -= closeQty;
          if (Math.abs(pos) < 1e-9) {
            pos = 0;
            trades.push(finish(cur!, instrument));
            cur = null;
          }
        }
      }
    }

    if (cur && pos !== 0) open.push({ instrument, rawSymbol: list[0].rawSymbol, netQty: pos, parts: cur.parts });
  }

  trades.sort((a, b) => a.entryAt.getTime() - b.entryAt.getTime());
  return { trades, open };
}

/** Segment of a round trip; equity depends on whether it was held overnight. */
export function segmentOf(rt: RoundTrip): Segment {
  if (rt.instrument.kind === "OPT") return "OPT";
  if (rt.instrument.kind === "FUT") return "FUT";
  return istDateKey(rt.entryAt) === istDateKey(rt.exitAt) ? "EQ_INTRADAY" : "EQ_DELIVERY";
}

/** Input for lib/trades.ts buildTradeData(). */
export function toRawTrade(rt: RoundTrip): RawTrade {
  const i = rt.instrument;
  return {
    exchange: rt.exchange,
    segment: segmentOf(rt),
    underlying: i.underlying,
    optionType: i.optionType ?? null,
    strike: i.strike ?? null,
    expiry: i.expiry ?? null,
    lotSize: i.kind === "EQ" ? null : (lotSizeFor(i.underlying) ?? null),
    direction: rt.direction,
    qty: rt.qty,
    avgEntry: rt.avgEntry,
    avgExit: rt.avgExit,
    entryAt: rt.entryAt,
    exitAt: rt.exitAt,
    buyOrders: rt.buyOrders,
    sellOrders: rt.sellOrders,
  };
}
