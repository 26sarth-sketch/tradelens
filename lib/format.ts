// Formatting helpers: Indian number system (₹1,25,000), lakh/crore, and IST times.
// All dates are stored as UTC instants and always displayed in Asia/Kolkata.

export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MIN = 330;

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,25,000 (or -₹1,250.50 with decimals). Pass `signed` to prefix "+" on gains. */
export function formatINR(
  value: number,
  opts: { decimals?: boolean; signed?: boolean } = {},
): string {
  const abs = Math.abs(value);
  const body = (opts.decimals ? inr2 : inr0).format(opts.decimals ? abs : Math.round(abs));
  const sign = value < 0 ? "-" : opts.signed && value > 0 ? "+" : "";
  return `${sign}₹${body}`;
}

/** Compact Indian units: ₹950, ₹12.5K, ₹3.2L, ₹1.4Cr. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number) => n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** "22 Oct 2026" */
export function formatDateIST(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "09:24" (24h, IST) */
export function formatTimeIST(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateTimeIST(d: Date | string): string {
  return `${formatDateIST(d)}, ${formatTimeIST(d)}`;
}

/** Calendar day key in IST, e.g. "2026-10-22". Used to group trades by trading day. */
export function istDateKey(d: Date | string): string {
  const shifted = new Date(new Date(d).getTime() + IST_OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Minutes since IST midnight (9:15 → 555). Used for time-of-day buckets. */
export function istMinutes(d: Date | string): number {
  const shifted = new Date(new Date(d).getTime() + IST_OFFSET_MIN * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Build a UTC Date from an IST wall-clock date ("2026-10-22") and time ("09:24"). */
export function fromIST(dateKey: string, time = "00:00"): Date {
  return new Date(`${dateKey}T${time.length === 5 ? `${time}:00` : time}+05:30`);
}

/** Text colour class for a P&L value. */
export function pnlClass(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-muted";
}

/** The instant `days` × 24h before now (for "last 30 days" style filters). */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
