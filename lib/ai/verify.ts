// "The model must not invent numbers": after every AI response we extract each
// figure it wrote (₹ amounts, percentages, R-multiples, decimals, larger counts)
// and check it against the numbers in the DATA we sent. Matches allow sensible
// rounding (₹1.56L for 1,55,959; 67% for 66.6) and simple differences/sums of
// two values of the same metric ("₹2,879 more per trade"). Anything else is flagged in the UI.

export type Verification = { checked: number; unverified: string[] };

const SKIP_KEYS = new Set(["id", "trade_id", "date", "from", "to"]);

/** Every number in the data, including numbers written inside strings. */
export function collectNumbers(data: unknown, out: number[] = []): number[] {
  if (typeof data === "number" && Number.isFinite(data)) out.push(data);
  else if (typeof data === "string") for (const f of extractFigures(data)) out.push(f.value);
  else if (Array.isArray(data)) data.forEach((d) => collectNumbers(d, out));
  else if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) if (!SKIP_KEYS.has(k)) collectNumbers(v, out);
  }
  return out;
}

export type Figure = {
  text: string;
  value: number;
  kind: "inr" | "pct" | "r" | "num";
  /** Half the precision the text was written with: ₹2,879 → 0.5, ₹1.56L → 500, 90% → 0.5, 52.7% → 0.05. */
  tolerance: number;
};

const FIGURE_RE =
  /([−-])?\s?(₹|rs\.?\s?|inr\s?)?([−-])?\s?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s?(?:(k|l|lakh|lakhs|cr|crore|crores)\b)?\s?(%|r\b|x\b)?/gi;

/** Figures written in text. Times (09:15), dates and small plain counts are skipped. */
export function extractFigures(text: string): Figure[] {
  const out: Figure[] = [];
  const cleaned = text
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ") // times
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ") // ISO dates
    .replace(/\b\d{1,2}\s(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi, " "); // "12 Oct"
  for (const m of cleaned.matchAll(FIGURE_RE)) {
    const [raw, minusBefore, rupee, minusAfter, digits, unit, suffix] = m;
    const minus = minusBefore || minusAfter;
    let value = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const u = unit?.toLowerCase();
    if (u === "k") value *= 1e3;
    else if (u?.startsWith("l")) value *= 1e5;
    else if (u?.startsWith("cr")) value *= 1e7;
    if (minus) value = -value;
    const s = suffix?.toLowerCase();
    const kind: Figure["kind"] = rupee ? "inr" : s === "%" ? "pct" : s === "r" ? "r" : "num";
    // Plain small integers are usually counts/ordinals ("3 rules", "2 PM", "top 5"): not checked.
    if (kind === "num" && !digits.includes(".") && Math.abs(value) < 100 && !u) continue;
    const plain = digits.replace(/,/g, "");
    const decimals = plain.includes(".") ? plain.split(".")[1].length : 0;
    const unitScale = u === "k" ? 1e3 : u?.startsWith("l") ? 1e5 : u?.startsWith("cr") ? 1e7 : 1;
    // Round thousands written as "₹12,900" or "₹1,50,000" are treated as rounded to their trailing zeros.
    const trailingZeros = decimals === 0 && unitScale === 1 ? (plain.match(/0+$/)?.[0].length ?? 0) : 0;
    const step = unitScale * 10 ** -decimals * 10 ** Math.min(trailingZeros, 3);
    out.push({ text: raw.trim(), value, kind, tolerance: step / 2 + 1e-6 });
  }
  return out;
}

/** Sign-insensitive ("lost ₹1,43,107" vs −143107) match within the figure's own precision. */
function close(f: Figure, k: number): boolean {
  const slack = f.kind === "inr" || f.kind === "num" ? 1 : 0.05; // data itself is rounded
  return Math.abs(Math.abs(f.value) - Math.abs(k)) <= f.tolerance + slack;
}

/**
 * Differences and sums between SIBLING values of the same metric only: the same key
 * across the items of one list (time buckets, groups) or the children of one object
 * (a comparison's two sides), plus a rule breach's value minus its own limit. That
 * covers "₹2,879 more per trade than…" without letting unrelated numbers combine
 * into a coincidental match.
 */
function siblingDerived(data: unknown, out: number[] = []): number[] {
  if (Array.isArray(data)) {
    pairUp(data, out);
    data.forEach((d) => siblingDerived(d, out));
  } else if (data && typeof data === "object") {
    // "₹3,545 over the limit": a measured value against its own limit in the same object.
    const o = data as Record<string, unknown>;
    for (const k of ["value", "current"]) {
      const v = o[k];
      if (typeof v === "number" && typeof o.limit === "number") out.push(v - o.limit);
    }
    const children = Object.values(data);
    pairUp(children, out);
    children.forEach((c) => siblingDerived(c, out));
  }
  return out;
}

function pairUp(items: unknown[], out: number[]) {
  const objs = items.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
  if (objs.length < 2 || objs.length > 20) return;
  const keys = new Set(objs.flatMap((o) => Object.keys(o)));
  for (const key of keys) {
    const vals = objs.map((o) => o[key]).filter((v): v is number => typeof v === "number");
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) out.push(vals[i] - vals[j], vals[i] + vals[j]);
  }
}

export function verifyNumbers(output: unknown, data: unknown): Verification {
  const known = [...new Set(collectNumbers(data).map((n) => Math.round(n * 100) / 100))];
  const figures = collectFigures(output);
  const derived = siblingDerived(data);
  const unverified: string[] = [];
  for (const f of figures) {
    const ok = known.some((k) => close(f, k)) || derived.some((k) => close(f, k));
    if (!ok) unverified.push(f.text);
  }
  return { checked: figures.length, unverified: [...new Set(unverified)] };
}

function collectFigures(output: unknown, out: Figure[] = []): Figure[] {
  if (typeof output === "string") out.push(...extractFigures(output));
  else if (Array.isArray(output)) output.forEach((o) => collectFigures(o, out));
  else if (output && typeof output === "object") Object.values(output).forEach((v) => collectFigures(v, out));
  return out;
}
