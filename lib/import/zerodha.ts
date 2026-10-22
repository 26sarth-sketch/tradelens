// Zerodha Console tradebook CSV (Console → Reports → Tradebook → Download CSV).
// Columns: symbol, isin, trade_date, exchange, segment, series, trade_type, auction,
//          quantity, price, trade_id, order_id, order_execution_time, expiry_date
// Exchange is NSE/BSE (cash) or NFO/BFO (F&O) depending on the export; both work.
// Commodity (MCX) and currency (CDS) rows are skipped.

import Papa from "papaparse";
import { fromIST } from "../format";
import type { Exchange } from "../types";
import { parseFnoSymbol } from "./symbols";
import type { Fill, Instrument, ParseIssue, ParseResult } from "./types";

const REQUIRED = ["symbol", "trade_date", "exchange", "trade_type", "quantity", "price"] as const;

export class NotZerodhaError extends Error {}

const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

/** "2026-10-13" or "13-10-2026" / "13/10/2026" → "2026-10-13" */
function dayKey(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Execution time in IST. Falls back to market open when the column is missing. */
function executedAt(tradeDate: string, execTime?: string): Date | null {
  const t = execTime?.trim();
  if (t) {
    const m = /^(\d{4}-\d{2}-\d{2}|\d{2}[-/]\d{2}[-/]\d{4})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(t);
    if (m) {
      const key = dayKey(m[1]);
      if (key) return fromIST(key, m[2].length === 5 ? `${m[2]}:00` : m[2]);
    }
  }
  const key = dayKey(tradeDate);
  return key ? fromIST(key, "09:15") : null;
}

export function looksLikeZerodha(headers: string[]): boolean {
  const set = new Set(headers.map(normHeader));
  return REQUIRED.every((h) => set.has(h)) && set.has("trade_id");
}

export function parseZerodhaTradebook(csv: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normHeader,
  });
  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new NotZerodhaError(
      `This doesn't look like a Zerodha tradebook (missing: ${missing.join(", ")}). Try the "Other broker" importer.`,
    );
  }

  const fills: Fill[] = [];
  const issues: ParseIssue[] = [];

  parsed.data.forEach((r, i) => {
    const row = i + 2; // header is row 1
    const symbol = (r.symbol ?? "").trim().toUpperCase();
    const ex = (r.exchange ?? "").trim().toUpperCase();
    const seg = (r.segment ?? "").trim().toUpperCase();
    const side = (r.trade_type ?? "").trim().toUpperCase();
    const qty = Number(String(r.quantity).replace(/,/g, ""));
    const price = Number(String(r.price).replace(/,/g, ""));

    if (!symbol) return issues.push({ row, message: "Missing symbol" });
    if (["MCX", "CDS", "BCD", "NCO"].includes(ex) || ["COM", "CDS", "CUR"].includes(seg)) {
      return issues.push({ row, message: `${symbol}: commodity/currency isn't supported yet, skipped` });
    }
    const exchange: Exchange | null = ex === "NSE" || ex === "NFO" ? "NSE" : ex === "BSE" || ex === "BFO" ? "BSE" : null;
    if (!exchange) return issues.push({ row, message: `${symbol}: unknown exchange "${r.exchange}"` });
    if (side !== "BUY" && side !== "SELL") return issues.push({ row, message: `${symbol}: trade_type must be buy or sell` });
    if (!(qty > 0) || !(price >= 0)) return issues.push({ row, message: `${symbol}: invalid quantity or price` });

    const at = executedAt(r.trade_date ?? "", r.order_execution_time);
    if (!at) return issues.push({ row, message: `${symbol}: can't read trade_date "${r.trade_date}"` });

    const isFno = ex === "NFO" || ex === "BFO" || seg === "FO" || seg === "F&O";
    let instrument: Instrument;
    if (isFno) {
      const p = parseFnoSymbol(symbol);
      if (!p) return issues.push({ row, message: `${symbol}: unrecognised F&O symbol, skipped` });
      const csvExpiry = r.expiry_date ? dayKey(r.expiry_date) : null;
      instrument = {
        key: `${exchange}:${symbol}`,
        kind: p.kind,
        underlying: p.underlying,
        optionType: p.optionType,
        strike: p.strike,
        expiry: csvExpiry ? fromIST(csvExpiry, "15:30") : p.expiry,
      };
    } else {
      instrument = { key: `${exchange}:${symbol}`, kind: "EQ", underlying: symbol };
    }

    const tradeId = (r.trade_id ?? "").trim();
    fills.push({
      instrument,
      rawSymbol: symbol,
      exchange,
      side,
      qty,
      price,
      executedAt: at,
      orderId: (r.order_id ?? "").trim() || undefined,
      brokerTradeId: tradeId ? `ZERODHA:${ex}:${tradeId}` : undefined,
      row,
    });
  });

  return { fills, issues, rowCount: parsed.data.length };
}
