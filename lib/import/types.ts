// Shared shapes for every importer. A broker parser turns its file into Fills;
// lib/import/roundtrip.ts turns Fills into complete round-trip trades.

import type { Exchange, OptionType, Side } from "../types";

/** What a tradable contract is. `kind` decides the segment of the resulting trade. */
export type Instrument = {
  /** Stable key for grouping fills, e.g. "NSE:NIFTY26O1325200CE". */
  key: string;
  kind: "EQ" | "FUT" | "OPT";
  underlying: string;
  optionType?: OptionType;
  strike?: number;
  expiry?: Date;
};

/** One broker execution, normalised. */
export type Fill = {
  instrument: Instrument;
  /** Symbol exactly as the broker wrote it. */
  rawSymbol: string;
  exchange: Exchange;
  side: Side;
  qty: number;
  price: number;
  executedAt: Date;
  orderId?: string;
  /** Unique per broker; used to skip fills that were already imported. */
  brokerTradeId?: string;
  /** 1-based CSV row, for error messages. */
  row: number;
};

export type ParseIssue = { row: number; message: string };

export type ParseResult = { fills: Fill[]; issues: ParseIssue[]; rowCount: number };
