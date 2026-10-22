// Expiry-day and lot-size lookups, driven by config/market.ts.
// Exchange holidays are not modelled: if an expiry falls on a holiday the exchange
// moves it a day earlier, which this will miss (see DECISIONS.md).

import { INDICES, STOCK_FNO_EXPIRY, STOCK_LOT_SIZES } from "@/config/market";
import { fromIST, istDateKey } from "./format";

type ExpiryRule = { expiryWeekday: number; expiryCycle: "WEEKLY" | "MONTHLY" };

export function expiryRuleFor(underlying: string): ExpiryRule {
  return INDICES[underlying.toUpperCase()] ?? STOCK_FNO_EXPIRY;
}

export function isIndex(underlying: string): boolean {
  return underlying.toUpperCase() in INDICES;
}

/** Lot size from config, or undefined if we don't know the symbol. */
export function lotSizeFor(underlying: string): number | undefined {
  const u = underlying.toUpperCase();
  return INDICES[u]?.lotSize ?? STOCK_LOT_SIZES[u];
}

/** Weekday (0=Sun) and day-of-month of an IST day key, computed in UTC to avoid TZ drift. */
function parts(dayKey: string) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  return { weekday: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

function isLastWeekdayOfMonth(dayKey: string): boolean {
  const { day, month, year } = parts(dayKey);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return day + 7 > daysInMonth;
}

/** Is this IST calendar day an expiry day for the underlying's F&O contracts? */
export function isExpiryDay(underlying: string, when: Date | string): boolean {
  const dayKey = typeof when === "string" && /^\d{4}-\d{2}-\d{2}$/.test(when) ? when : istDateKey(when);
  const rule = expiryRuleFor(underlying);
  if (parts(dayKey).weekday !== rule.expiryWeekday) return false;
  return rule.expiryCycle === "WEEKLY" || isLastWeekdayOfMonth(dayKey);
}

/** The next expiry on or after `from` (IST), as a UTC instant at 15:30 IST. */
export function nextExpiry(underlying: string, from: Date = new Date()): Date {
  let key = istDateKey(from);
  for (let i = 0; i < 62; i++) {
    if (isExpiryDay(underlying, key)) return fromIST(key, "15:30");
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    key = d.toISOString().slice(0, 10);
  }
  throw new Error(`No expiry found for ${underlying}`);
}
