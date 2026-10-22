// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE NOTE (not implemented; roadmap: broker API auto-sync)
// ─────────────────────────────────────────────────────────────────────────────
//
// Today trades arrive from files: a broker-specific parser (zerodha.ts) or the
// column-mapped generic parser (generic.ts) produces `Fill[]`, and the shared
// pipeline in service.ts does dedupe → round trips → charges → save.
//
// Auto-sync plugs in at exactly the same point. A BrokerAdapter fetches fills over
// the broker's API instead of a file, and everything downstream stays unchanged:
//
//   KiteConnectAdapter ─┐
//   UpstoxAdapter ──────┼─► Fill[] ─► service.previewImport / commitImport
//   DhanAdapter ────────┘              (dedupe by brokerTradeId, round trips, charges)
//
// Notes for implementers (verify endpoints against each broker's current API docs):
// • Kite Connect: OAuth-style login gives a daily access token (expires each morning);
//   GET /trades returns only TODAY's fills, so sync must run daily (e.g. 15:45 IST)
//   and history comes from a one-time Console CSV import.
// • Upstox API v2: OAuth2; GET /order/trades/get-trades-for-day for today, and a
//   historical trades endpoint for past dates.
// • Dhan HQ API: access token from the Dhan web app; GET /trades for today and a
//   trade-history endpoint by date range.
// • Store tokens encrypted per user; never log them. Map each API's trade id into
//   brokerTradeId as "<BROKER>:<EXCHANGE>:<id>" so API sync and CSV imports dedupe
//   against each other.

import type { Fill } from "../types";

export type BrokerId = "ZERODHA" | "UPSTOX" | "DHAN" | "ANGELONE" | "GROWW";

export interface BrokerAdapter {
  id: BrokerId;
  name: string;
  /** How the user connects, e.g. an OAuth redirect URL. */
  getConnectUrl(userId: string, redirectUri: string): Promise<string>;
  /** Exchange the OAuth callback for stored credentials. */
  completeConnect(userId: string, callbackParams: URLSearchParams): Promise<void>;
  /** True if stored credentials are still valid (Kite tokens expire daily). */
  isConnected(userId: string): Promise<boolean>;
  /** Fills executed since `since` (IST), normalised exactly like the CSV parsers. */
  fetchFills(userId: string, since: Date): Promise<Fill[]>;
}

/** Placeholder registry; adapters register here once built. */
export const BROKER_ADAPTERS: Partial<Record<BrokerId, BrokerAdapter>> = {};
