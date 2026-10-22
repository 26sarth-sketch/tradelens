/**
 * Indian market configuration: every rate, lot size and expiry rule lives here.
 *
 * ⚠️ VERIFY CURRENT RATES BEFORE DEMO. SEBI, the exchanges and the Union Budget change
 * these often (STT changed in Oct 2024 and again from 1 Apr 2026; NSE revised lot sizes
 * in Dec 2025 / Jan 2026; weekly expiries moved to Tuesday from Sep 2025).
 * Sources to check: NSE/BSE circulars, a broker's "charges" page (e.g. Zerodha).
 *
 * All percentages are written as fractions: 0.03% => 0.0003.
 * After editing, use Settings → "Recompute charges" so stored trades pick up the change.
 */

import type { Exchange, Segment } from "@/lib/types";

export const MARKET_CONFIG_AS_OF = "2026-10-22";

// ─── Brokerage ────────────────────────────────────────────────────────────────

export type BrokerageRule =
  | { kind: "zero" }
  | { kind: "flat"; perOrder: number }
  /** min(pct × order value, cap) per executed order */
  | { kind: "pctCapped"; pct: number; cap: number };

export type BrokeragePlan = { label: string; rules: Record<Segment, BrokerageRule> };

export const BROKERAGE_PLANS = {
  /** Typical discount broker (Zerodha/Upstox/Angel One style). */
  DISCOUNT: {
    label: "Discount broker (₹20/order, free delivery)",
    rules: {
      EQ_DELIVERY: { kind: "zero" },
      EQ_INTRADAY: { kind: "pctCapped", pct: 0.0003, cap: 20 },
      FUT: { kind: "pctCapped", pct: 0.0003, cap: 20 },
      OPT: { kind: "flat", perOrder: 20 },
    },
  },
  /** Flat ₹20 on everything, including delivery (e.g. some Dhan/Groww plans). */
  FLAT20: {
    label: "Flat ₹20 per order on all segments",
    rules: {
      EQ_DELIVERY: { kind: "flat", perOrder: 20 },
      EQ_INTRADAY: { kind: "flat", perOrder: 20 },
      FUT: { kind: "flat", perOrder: 20 },
      OPT: { kind: "flat", perOrder: 20 },
    },
  },
} satisfies Record<string, BrokeragePlan>;

export type BrokeragePlanKey = keyof typeof BROKERAGE_PLANS;
export const DEFAULT_BROKERAGE_PLAN: BrokeragePlanKey = "DISCOUNT";

// ─── Statutory charges ────────────────────────────────────────────────────────

/**
 * Securities Transaction Tax. Options STT is on the premium (sell side).
 * Not modelled: STT on exercised ITM options (0.125% of intrinsic value).
 */
export const STT: Record<Segment, { buy: number; sell: number }> = {
  EQ_DELIVERY: { buy: 0.001, sell: 0.001 }, // 0.1% both sides
  EQ_INTRADAY: { buy: 0, sell: 0.00025 }, // 0.025% sell
  FUT: { buy: 0, sell: 0.0005 }, // 0.05% sell (raised from 0.02% on 1 Apr 2026)
  OPT: { buy: 0, sell: 0.0015 }, // 0.15% of sell premium (raised from 0.1% on 1 Apr 2026)
};

/** Exchange transaction charges on total turnover (buy + sell), per exchange. */
export const EXCHANGE_TXN: Record<Exchange, Record<Segment, number>> = {
  NSE: {
    EQ_DELIVERY: 0.0000297, // 0.00297%
    EQ_INTRADAY: 0.0000297,
    FUT: 0.0000173, // 0.00173%
    OPT: 0.0003503, // 0.03503% of premium
  },
  BSE: {
    EQ_DELIVERY: 0.0000375, // 0.00375%
    EQ_INTRADAY: 0.0000375,
    FUT: 0, // BSE index futures: currently nil
    OPT: 0.000325, // 0.0325% of premium (SENSEX/BANKEX)
  },
};

/** SEBI turnover fee: ₹10 per crore on total turnover. */
export const SEBI_FEE = 10 / 1e7;

/** Stamp duty, charged on the BUY side only. */
export const STAMP_DUTY: Record<Segment, number> = {
  EQ_DELIVERY: 0.00015, // 0.015%
  EQ_INTRADAY: 0.00003, // 0.003%
  FUT: 0.00002, // 0.002%
  OPT: 0.00003, // 0.003% of premium
};

/** GST on brokerage + exchange transaction charges + SEBI fee. */
export const GST_RATE = 0.18;

/** Depository (DP) charge per scrip per delivery sell, GST included. */
export const DP_CHARGE_PER_SELL = 15.34;

// ─── Instruments ──────────────────────────────────────────────────────────────

export type IndexInfo = {
  exchange: Exchange;
  lotSize: number;
  /** 0=Sun … 6=Sat. Expiry day; if it's a holiday the exchange moves it earlier. */
  expiryWeekday: number;
  /** WEEKLY: every week. MONTHLY: only the last such weekday of the month. */
  expiryCycle: "WEEKLY" | "MONTHLY";
  /** Strike step, used to sanity-check imported option symbols. */
  strikeStep: number;
};

export const INDICES: Record<string, IndexInfo> = {
  NIFTY: { exchange: "NSE", lotSize: 65, expiryWeekday: 2, expiryCycle: "WEEKLY", strikeStep: 50 },
  BANKNIFTY: { exchange: "NSE", lotSize: 30, expiryWeekday: 2, expiryCycle: "MONTHLY", strikeStep: 100 },
  FINNIFTY: { exchange: "NSE", lotSize: 60, expiryWeekday: 2, expiryCycle: "MONTHLY", strikeStep: 50 },
  MIDCPNIFTY: { exchange: "NSE", lotSize: 120, expiryWeekday: 2, expiryCycle: "MONTHLY", strikeStep: 25 },
  SENSEX: { exchange: "BSE", lotSize: 20, expiryWeekday: 4, expiryCycle: "WEEKLY", strikeStep: 100 },
  BANKEX: { exchange: "BSE", lotSize: 30, expiryWeekday: 4, expiryCycle: "MONTHLY", strikeStep: 100 },
};

/** Stock F&O expires on the last Tuesday of the month (NSE). */
export const STOCK_FNO_EXPIRY = { expiryWeekday: 2, expiryCycle: "MONTHLY" as const };

/** Lot sizes for common F&O stocks. Anything else: user enters it, or we fall back to qty. */
export const STOCK_LOT_SIZES: Record<string, number> = {
  RELIANCE: 500,
  HDFCBANK: 550,
  ICICIBANK: 700,
  INFY: 400,
  TCS: 175,
  SBIN: 750,
  TATAMOTORS: 800,
  AXISBANK: 625,
  BAJFINANCE: 750,
  ITC: 1600,
};

// ─── Session ──────────────────────────────────────────────────────────────────

/** NSE/BSE cash and F&O normal market hours (IST). */
export const MARKET_OPEN = "09:15";
export const MARKET_CLOSE = "15:30";
