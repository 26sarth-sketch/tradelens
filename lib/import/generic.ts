// Generic broker CSV importer. The user (or a preset) maps CSV columns to our
// fields; this turns each row into a Fill. Works for Upstox, Angel One, Groww, Dhan
// and anything else that exports one row per execution.
//
// Instrument detection, in order:
//   1. Exchange-style symbol (NIFTY26O1325200CE, BANKNIFTY26OCTFUT) → lib/import/symbols.ts
//   2. Separate columns (strike / option type / instrument type / expiry)
//   3. Spaced symbol ("NIFTY 25300 CE 20 OCT 26", "BANKNIFTY OCT FUT")
//   4. Otherwise equity (suffixes like "-EQ" are stripped)
// Dates are read day-first (DD-MM-YYYY), as Indian brokers write them.

import Papa from "papaparse";
import { expiryRuleFor, lotSizeFor } from "../expiry";
import { fromIST } from "../format";
import type { Exchange, OptionType } from "../types";
import { parseFnoSymbol } from "./symbols";
import type { Fill, Instrument, ParseIssue, ParseResult } from "./types";

export const MAPPING_FIELDS = [
  { key: "date", label: "Trade date (or date + time)", required: true },
  { key: "time", label: "Trade time", required: false },
  { key: "symbol", label: "Symbol / scrip name", required: true },
  { key: "side", label: "Buy / Sell", required: true },
  { key: "qty", label: "Quantity", required: true },
  { key: "price", label: "Price", required: true },
  { key: "exchange", label: "Exchange", required: false },
  { key: "segment", label: "Segment", required: false },
  { key: "instrumentType", label: "Instrument type (OPTIDX, FUTSTK…)", required: false },
  { key: "underlying", label: "Underlying", required: false },
  { key: "strike", label: "Strike price", required: false },
  { key: "optionType", label: "Option type (CE/PE)", required: false },
  { key: "expiry", label: "Expiry date", required: false },
  { key: "tradeId", label: "Trade ID", required: false },
  { key: "orderId", label: "Order ID", required: false },
  { key: "status", label: "Order status (skips rejected/cancelled)", required: false },
] as const;

export type MappingField = (typeof MAPPING_FIELDS)[number]["key"];
/** Our field → CSV header. */
export type ColumnMap = Partial<Record<MappingField, string>>;
export type GenericOptions = {
  /** Used to namespace dedupe ids, e.g. "UPSTOX". */
  broker: string;
  /** Some brokers report F&O quantity in lots. */
  qtyInLots?: boolean;
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n: number | string) => String(n).padStart(2, "0");

// ─── Dates ────────────────────────────────────────────────────────────────────

/** Day key from "2026-10-13", "13-10-2026", "13/10/26", "13-Oct-2026", "13 Oct 2026", "Oct 13, 2026". */
export function parseDay(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = /^(\d{1,2})[-\s/]([A-Z]{3})[A-Z]*[-\s/,]+(\d{2,4})/.exec(s);
  if (m && MONTHS.includes(m[2])) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad(MONTHS.indexOf(m[2]) + 1)}-${pad(m[1])}`;
  m = /^([A-Z]{3})[A-Z]*\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (m && MONTHS.includes(m[1])) return `${m[3]}-${pad(MONTHS.indexOf(m[1]) + 1)}-${pad(m[2])}`;
  return null;
}

/** "09:31", "9:31:05", "02:15 PM" → "HH:MM:SS" (24h). */
export function parseTime(raw: string): string | null {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = m[4]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${pad(h)}:${m[2]}:${m[3] ?? "00"}`;
}

function parseDateTime(dateRaw: string, timeRaw?: string): Date | null {
  const day = parseDay(dateRaw);
  if (!day) return null;
  // Time from its own column, else from the date cell ("13-10-2026 09:31:12"), else market open.
  const rest = dateRaw.replace(/^\S+\s?/, "");
  const time = (timeRaw && parseTime(timeRaw)) || (dateRaw.includes(":") ? parseTime(rest || dateRaw) : null) || "09:15:00";
  return fromIST(day, time);
}

// ─── Instruments ──────────────────────────────────────────────────────────────

function lastWeekdayOfMonth(year: number, month1: number, weekday: number): string {
  const d = new Date(Date.UTC(year, month1, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "NIFTY 25300 CE 20 OCT 26", "NIFTY 20OCT2026 25300 CALL", "BANKNIFTY OCT FUT". */
export function parseSpacedFno(symbol: string): Omit<Instrument, "key"> | null {
  const s = symbol.toUpperCase().replace(/([A-Z])(\d)|(\d)([A-Z])/g, (_, a, b, c, d) => (a ? `${a} ${b}` : `${c} ${d}`));
  const tokens = s.split(/[\s_\-/,]+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const typeTok = tokens.find((t) => ["CE", "PE", "CALL", "PUT", "FUT", "FUTURES"].includes(t));
  if (!typeTok) return null;
  const kind = typeTok.startsWith("FUT") ? "FUT" : "OPT";
  const optionType: OptionType | undefined = kind === "OPT" ? (typeTok === "CE" || typeTok === "CALL" ? "CE" : "PE") : undefined;

  const underlying = tokens[0];
  const monthIdx = tokens.findIndex((t) => MONTHS.includes(t.slice(0, 3)) && t.length <= 9);
  const nums = tokens.map((t, i) => ({ t, i, n: Number(t) })).filter((x) => /^\d+(\.\d+)?$/.test(x.t));

  let expiry: Date | undefined;
  const used = new Set<number>();
  if (monthIdx >= 0) {
    const month = MONTHS.indexOf(tokens[monthIdx].slice(0, 3)) + 1;
    const before = nums.find((x) => x.i === monthIdx - 1 && x.n >= 1 && x.n <= 31);
    const after = nums.find((x) => x.i === monthIdx + 1 && (x.t.length === 2 || x.t.length === 4) && x.n >= 20);
    const year = after ? (after.t.length === 2 ? 2000 + after.n : after.n) : new Date().getUTCFullYear();
    if (after) used.add(after.i);
    if (before) {
      used.add(before.i);
      expiry = fromIST(`${year}-${pad(month)}-${pad(before.n)}`, "15:30");
    } else {
      expiry = fromIST(lastWeekdayOfMonth(year, month, expiryRuleFor(underlying).expiryWeekday), "15:30");
    }
  }
  const strikeTok = kind === "OPT" ? nums.filter((x) => !used.has(x.i) && x.n >= 10).sort((a, b) => b.n - a.n)[0] : undefined;
  if (kind === "OPT" && !strikeTok) return null;

  return { kind, underlying, optionType, strike: strikeTok?.n, expiry };
}

const cleanEquity = (s: string) => s.toUpperCase().replace(/[-\s](EQ|BE|BZ|SM|ST)$/, "").trim();

function resolveInstrument(get: (f: MappingField) => string): Omit<Instrument, "key"> | { error: string } {
  const symbol = get("symbol").toUpperCase();

  const exact = parseFnoSymbol(symbol.replace(/\s+/g, ""));
  if (exact) return { ...exact };

  const instType = get("instrumentType").toUpperCase();
  const strike = Number(get("strike").replace(/,/g, ""));
  const optRaw = get("optionType").toUpperCase();
  const optionType: OptionType | undefined = optRaw.startsWith("C") ? "CE" : optRaw.startsWith("P") ? "PE" : undefined;
  const expiryDay = get("expiry") ? parseDay(get("expiry")) : null;
  const columnKind = instType.startsWith("OPT") || (strike > 0 && optionType) ? "OPT" : instType.startsWith("FUT") ? "FUT" : null;

  if (columnKind) {
    const spaced = parseSpacedFno(symbol);
    const underlying = (get("underlying") || spaced?.underlying || symbol.split(/[\s\-_]/)[0]).toUpperCase();
    const ot = optionType ?? spaced?.optionType;
    const k = strike > 0 ? strike : spaced?.strike;
    if (columnKind === "OPT" && (!ot || !k)) return { error: `${symbol}: option without strike or CE/PE` };
    return {
      kind: columnKind,
      underlying,
      optionType: columnKind === "OPT" ? ot : undefined,
      strike: columnKind === "OPT" ? k : undefined,
      expiry: expiryDay ? fromIST(expiryDay, "15:30") : spaced?.expiry,
    };
  }

  const spaced = parseSpacedFno(symbol);
  if (spaced) {
    if (expiryDay) spaced.expiry = fromIST(expiryDay, "15:30");
    return spaced;
  }
  return { kind: "EQ", underlying: cleanEquity(symbol) };
}

// ─── Rows → fills ─────────────────────────────────────────────────────────────

/** Small stable hash for rows without a trade id. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function readCsv(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { headers: (parsed.meta.fields ?? []).filter(Boolean), rows: parsed.data };
}

export function parseGenericCsv(csv: string, map: ColumnMap, opts: GenericOptions): ParseResult {
  const missing = MAPPING_FIELDS.filter((f) => f.required && !map[f.key]).map((f) => f.label);
  if (missing.length) throw new Error(`Map these columns first: ${missing.join(", ")}`);

  const { rows } = readCsv(csv);
  const fills: Fill[] = [];
  const issues: ParseIssue[] = [];
  const seenRowKeys = new Map<string, number>();
  const broker = opts.broker.toUpperCase().replace(/[^A-Z0-9]/g, "") || "GENERIC";

  rows.forEach((r, i) => {
    const row = i + 2;
    const get = (f: MappingField) => (map[f] ? String(r[map[f]!] ?? "").trim() : "");
    const symbolRaw = get("symbol");
    if (!symbolRaw) return issues.push({ row, message: "Missing symbol" });
    if (/reject|cancel|fail|pending|open/i.test(get("status"))) {
      return issues.push({ row, message: `${symbolRaw}: order ${get("status").toLowerCase()}, skipped` });
    }

    const sideRaw = get("side").toUpperCase();
    const side = sideRaw.startsWith("B") ? "BUY" : sideRaw.startsWith("S") ? "SELL" : null;
    if (!side) return issues.push({ row, message: `${symbolRaw}: can't tell buy or sell from "${get("side")}"` });

    let qty = Math.abs(Number(get("qty").replace(/,/g, "")));
    const price = Number(get("price").replace(/[,₹\s]/g, ""));
    if (!(qty > 0) || !(price >= 0)) return issues.push({ row, message: `${symbolRaw}: invalid quantity or price` });

    const executedAt = parseDateTime(get("date"), get("time"));
    if (!executedAt) return issues.push({ row, message: `${symbolRaw}: can't read date "${get("date")}"` });

    const exRaw = get("exchange").toUpperCase();
    if (/MCX|CDS|NCDEX|COM|CUR/.test(`${exRaw} ${get("segment").toUpperCase()}`)) {
      return issues.push({ row, message: `${symbolRaw}: commodity/currency isn't supported yet, skipped` });
    }
    const exchange: Exchange = exRaw.startsWith("B") ? "BSE" : "NSE";

    const inst = resolveInstrument(get);
    if ("error" in inst) return issues.push({ row, message: inst.error });
    if (inst.kind !== "EQ" && !inst.expiry) return issues.push({ row, message: `${symbolRaw}: F&O row without an expiry` });
    if (opts.qtyInLots && inst.kind !== "EQ") {
      const ls = lotSizeFor(inst.underlying);
      if (!ls) return issues.push({ row, message: `${symbolRaw}: quantity is in lots but lot size of ${inst.underlying} is unknown` });
      qty *= ls;
    }

    const key =
      inst.kind === "EQ"
        ? `${exchange}:${inst.underlying}`
        : `${exchange}:${inst.underlying}:${inst.kind}:${inst.strike ?? ""}:${inst.optionType ?? ""}:${inst.expiry!.toISOString().slice(0, 10)}`;

    // Dedupe id: the broker's trade id, or a hash of the row (+ occurrence for identical rows).
    const tradeId = get("tradeId");
    let brokerTradeId: string;
    if (tradeId) {
      brokerTradeId = `${broker}:${exchange}:${tradeId}`;
    } else {
      const rowKey = [executedAt.toISOString(), key, side, qty, price].join("|");
      const n = (seenRowKeys.get(rowKey) ?? 0) + 1;
      seenRowKeys.set(rowKey, n);
      brokerTradeId = `${broker}:H:${hash(rowKey)}:${n}`;
    }

    fills.push({
      instrument: { ...inst, key },
      rawSymbol: symbolRaw,
      exchange,
      side,
      qty,
      price,
      executedAt,
      orderId: get("orderId") || undefined,
      brokerTradeId,
      row,
    });
  });

  return { fills, issues, rowCount: rows.length };
}

