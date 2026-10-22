// String unions for the "enum-like" columns in prisma/schema.prisma.

export const EXCHANGES = ["NSE", "BSE"] as const;
export type Exchange = (typeof EXCHANGES)[number];

export const SEGMENTS = ["EQ_INTRADAY", "EQ_DELIVERY", "FUT", "OPT"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  EQ_INTRADAY: "Equity intraday",
  EQ_DELIVERY: "Equity delivery",
  FUT: "Futures",
  OPT: "Options",
};

export type Side = "BUY" | "SELL";
export type Direction = "LONG" | "SHORT";
export type OptionType = "CE" | "PE";

export const EMOTIONS = ["Confident", "Calm", "Fearful", "FOMO", "Revenge", "Bored"] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const LEVELS = ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
export type Level = (typeof LEVELS)[number];

export type Language = "EN" | "HINGLISH";
export type ImportSource = "MANUAL" | "ZERODHA" | "GENERIC" | "SEED";
export type TagKind = "USER" | "AI";

export const RISK_RULES = [
  "DAILY_LOSS",
  "TRADE_COUNT",
  "PER_TRADE_LOSS",
  "CONSEC_LOSSES",
  "TIME_CUTOFF",
] as const;
export type RiskRule = (typeof RISK_RULES)[number];

export type AiReportType = "FIRST_IMPORT" | "WEEKLY" | "SESSION" | "TRADE";
