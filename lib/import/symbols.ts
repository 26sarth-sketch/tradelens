// Parses NSE/BSE F&O trading symbols as Zerodha (and most Indian brokers) write them:
//   Weekly option : NIFTY 26 O 13 25200 CE   → NIFTY26O1325200CE   (YY, month code, DD)
//   Monthly option: BANKNIFTY 26 OCT 52000 PE → BANKNIFTY26OCT52000PE
//   Futures       : NIFTY 26 OCT FUT          → NIFTY26OCTFUT
// Weekly month codes: 1–9 = Jan–Sep, O = Oct, N = Nov, D = Dec.
// Monthly contracts expire on the last expiry weekday of the month (config/market.ts).

import { expiryRuleFor } from "../expiry";
import { fromIST } from "../format";
import type { OptionType } from "../types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKLY_MONTH: Record<string, number> = { O: 10, N: 11, D: 12 };

const MONTHLY_RE = /^([A-Z][A-Z&-]*?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(\d+(?:\.\d+)?)(CE|PE)|(FUT))$/;
const WEEKLY_RE = /^([A-Z][A-Z&-]*?)(\d{2})([1-9OND])(\d{2})(\d+(?:\.\d+)?)(CE|PE)$/;

export type ParsedSymbol = {
  underlying: string;
  kind: "FUT" | "OPT";
  optionType?: OptionType;
  strike?: number;
  /** Expiry as a UTC instant at 15:30 IST. */
  expiry: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Last `weekday` (0=Sun) of a month, as an IST day key. */
function lastWeekdayOfMonth(year: number, month1: number, weekday: number): string {
  const d = new Date(Date.UTC(year, month1, 0)); // last day of month
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function parseFnoSymbol(symbol: string): ParsedSymbol | null {
  const s = symbol.trim().toUpperCase();

  const w = WEEKLY_RE.exec(s);
  if (w) {
    const [, underlying, yy, m, dd, strike, type] = w;
    const month = WEEKLY_MONTH[m] ?? Number(m);
    return {
      underlying,
      kind: "OPT",
      optionType: type as OptionType,
      strike: Number(strike),
      expiry: fromIST(`20${yy}-${pad(month)}-${dd}`, "15:30"),
    };
  }

  const mo = MONTHLY_RE.exec(s);
  if (mo) {
    const [, underlying, yy, mmm, strike, type, fut] = mo;
    const rule = expiryRuleFor(underlying);
    const expiry = fromIST(lastWeekdayOfMonth(2000 + Number(yy), MONTHS.indexOf(mmm) + 1, rule.expiryWeekday), "15:30");
    return fut
      ? { underlying, kind: "FUT", expiry }
      : { underlying, kind: "OPT", optionType: type as OptionType, strike: Number(strike), expiry };
  }

  return null;
}
