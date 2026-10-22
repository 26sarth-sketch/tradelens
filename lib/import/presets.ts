// Column-mapping presets for common Indian brokers. Each preset lists header names to
// look for (case/space-insensitive), most likely first. They're best guesses at each
// broker's tradebook export and only pre-fill the mapping screen; the user can change
// any column. ⚠️ Verify against a real export from each broker before relying on them.

import type { ColumnMap, MappingField } from "./generic";

export type BrokerPreset = {
  id: string;
  name: string;
  hint: string;
  qtyInLots?: boolean;
  aliases: Partial<Record<MappingField, string[]>>;
};

/** Header names most brokers use. Presets are tried first, then these. */
const COMMON: Partial<Record<MappingField, string[]>> = {
  date: ["trade date", "date", "trade_date", "order date", "execution date", "date and time", "execution date and time", "trade datetime"],
  time: ["trade time", "time", "execution time", "order execution time", "exchange time"],
  symbol: ["symbol", "trading symbol", "tradingsymbol", "scrip", "scrip name", "instrument", "stock name", "name", "contract", "security"],
  side: ["side", "buy/sell", "type", "trade type", "transaction type", "action", "b/s", "buy sell"],
  qty: ["quantity", "qty", "traded qty", "filled qty", "trade qty", "quantity/lot"],
  price: ["price", "trade price", "rate", "avg price", "average price", "traded price", "execution price"],
  exchange: ["exchange", "exch"],
  segment: ["segment", "product segment", "market segment"],
  instrumentType: ["instrument type", "instrument_type", "inst type", "series"],
  underlying: ["underlying", "underlying symbol"],
  strike: ["strike", "strike price", "strike_price"],
  optionType: ["option type", "option_type", "call/put", "opt type"],
  expiry: ["expiry", "expiry date", "expiry_date"],
  tradeId: ["trade id", "trade no", "trade num", "trade number", "trade_id", "exchange trade id"],
  orderId: ["order id", "order no", "order num", "order number", "order_id", "exchange order id"],
  status: ["status", "order status", "trade status"],
};

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    id: "upstox",
    name: "Upstox",
    hint: "Upstox → Reports → Trade book (download CSV/Excel, save as CSV).",
    aliases: {
      date: ["date", "trade date"],
      time: ["trade time"],
      symbol: ["scrip name", "company", "symbol"],
      side: ["side", "buy/sell"],
      price: ["price", "rate"],
      tradeId: ["trade num", "trade no"],
      orderId: ["order num", "order no"],
    },
  },
  {
    id: "angelone",
    name: "Angel One",
    hint: "Angel One → Reports → Trade book / Transaction statement (export CSV).",
    aliases: {
      date: ["trade date", "date"],
      symbol: ["symbol", "scrip name", "scrip"],
      side: ["buy/sell", "transaction type", "b/s"],
      qty: ["qty", "quantity"],
      price: ["rate", "trade price", "price"],
      tradeId: ["trade no", "trade id"],
      orderId: ["order no", "order id"],
    },
  },
  {
    id: "groww",
    name: "Groww",
    hint: "Groww → Profile → Reports → Order history / Trade book (CSV). No trade ids, so rows are matched by content.",
    aliases: {
      date: ["execution date and time", "date and time", "date"],
      symbol: ["symbol", "stock name", "name"],
      side: ["type", "buy/sell"],
      price: ["price", "avg price"],
    },
  },
  {
    id: "dhan",
    name: "Dhan",
    hint: "Dhan → Reports → Trade history (CSV). If F&O quantity is shown in lots, tick “Quantity is in lots”.",
    aliases: {
      date: ["date", "trade date"],
      time: ["time", "trade time"],
      symbol: ["name", "trading symbol", "symbol"],
      side: ["buy/sell", "transaction type"],
      qty: ["quantity/lot", "quantity", "qty"],
      price: ["trade price", "price"],
      tradeId: ["trade id", "exchange trade id"],
      orderId: ["order id"],
    },
  },
  {
    id: "other",
    name: "Other broker",
    hint: "Any CSV with one row per executed trade: date, symbol, buy/sell, quantity, price.",
    aliases: {},
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]+/g, " ").trim();

/** Fills a mapping from headers: preset aliases first, then common names. */
export function autoMap(headers: string[], preset?: BrokerPreset): ColumnMap {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const map: ColumnMap = {};
  const taken = new Set<string>();
  const fields = Object.keys(COMMON) as MappingField[];
  for (const f of fields) {
    const candidates = [...(preset?.aliases[f] ?? []), ...(COMMON[f] ?? [])];
    for (const c of candidates) {
      const h = byNorm.get(norm(c));
      if (h && !taken.has(h)) {
        map[f] = h;
        taken.add(h);
        break;
      }
    }
  }
  return map;
}

/** Which preset best matches these headers (by how many preset-specific aliases hit). */
export function detectPreset(headers: string[]): BrokerPreset {
  const set = new Set(headers.map(norm));
  let best = BROKER_PRESETS[BROKER_PRESETS.length - 1];
  let bestScore = 0;
  for (const p of BROKER_PRESETS) {
    const score = Object.values(p.aliases).filter((names) => names?.some((n) => set.has(norm(n)))).length;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}
