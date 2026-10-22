// Pure helpers for the in-app Guide: search the built-in knowledge, validate links, build answers
// without AI, suggest questions for the current page, and describe the tour and setup checklist.
// No server or database access here, so it is easy to test and safe to import from the client.

import { GUIDE_ROUTES, GUIDE_TOPICS, type GuideRoute, type GuideTopic } from "./knowledge";

export type GuideLink = { label: string; href: string };
export type GuideReply = {
  answer: string;
  links: GuideLink[];
  followUps: string[];
  /** "ai" = written by the model from the knowledge base; "kb" = assembled from the built-in help. */
  via: "ai" | "kb";
  note?: string;
};

const ROUTE_BY_HREF = new Map(GUIDE_ROUTES.map((r) => [r.href, r]));

const STOP = new Set(["the", "a", "an", "is", "are", "to", "do", "i", "my", "me", "of", "in", "on", "it", "how", "what", "can", "and", "or", "for", "with", "this", "that", "where", "does", "should", "get", "use", "tradelens"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹%+\- ]+/g, " ").replace(/\s+/g, " ").trim();
/** Crude stemming so "sharing" matches "share", "charges" matches "charge", "trades" matches "trade". */
const stem = (w: string) => {
  for (const suf of ["ing", "ed", "es", "s", "e"]) if (w.length > 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  return w;
};
const stemmed = (s: string) => norm(s).split(" ").filter(Boolean).map(stem).join(" ");
const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP.has(w)).map(stem);

export type RankedTopic = { topic: GuideTopic; score: number };

/** Score every topic against a question: phrase hits in keywords count most, then whole title words. */
export function rankTopics(question: string): RankedTopic[] {
  const q = stemmed(question);
  const qw = new Set(words(question));
  if (!q) return [];
  return GUIDE_TOPICS.map((topic) => {
    let score = 0;
    for (const k of topic.keywords) {
      const kn = stemmed(k);
      if (!kn) continue;
      const n = kn.split(" ").length;
      if (` ${q} `.includes(` ${kn} `)) score += 3 + Math.min(n - 1, 2); // longer phrase = stronger
      else if (n === 1 && qw.has(kn)) score += 2;
    }
    const title = new Set(words(topic.title));
    for (const w of qw) if (w.length > 3 && title.has(w)) score += 1;
    return { topic, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function searchTopics(question: string, limit = 3): GuideTopic[] {
  return rankTopics(question).slice(0, limit).map((x) => x.topic);
}

/** Keep only links that point at real pages of this app (never external URLs, never invented paths). */
export function sanitizeLinks(links: { label?: unknown; href?: unknown }[] | undefined | null, max = 3): GuideLink[] {
  const out: GuideLink[] = [];
  for (const l of links ?? []) {
    if (typeof l?.href !== "string") continue;
    const href = l.href.trim();
    const route: GuideRoute | undefined = ROUTE_BY_HREF.get(href);
    if (!route || out.some((o) => o.href === href)) continue;
    const label = typeof l.label === "string" && l.label.trim() ? l.label.trim().slice(0, 40) : route.label;
    out.push({ label, href });
    if (out.length >= max) break;
  }
  return out;
}

const DEFAULT_FOLLOW_UPS = ["How do I import my trades?", "What does the Dashboard show?", "How do risk rules work?"];

/** An answer built only from the built-in help (used when AI is off, rate-limited or unavailable). */
export function kbAnswer(question: string, note?: string): GuideReply {
  const ranked = rankTopics(question);
  // Show a second topic only when it is nearly as relevant as the first.
  const hits = ranked.filter((x, i) => i === 0 || (i === 1 && x.score >= ranked[0].score * 0.7)).map((x) => x.topic);
  if (hits.length === 0) {
    return {
      answer:
        "I couldn't find that in the built-in help. Try asking about a feature, such as importing trades, the Dashboard, risk rules, strategies, the Notebook or the AI Coach, or open **Learn** for short lessons.",
      links: sanitizeLinks([{ href: "/learn" }, { href: "/dashboard" }]),
      followUps: DEFAULT_FOLLOW_UPS,
      via: "kb",
      note,
    };
  }
  const parts = hits.map((t, i) => {
    const steps = i === 0 && t.steps ? `\n\n${t.steps.map((s, n) => `${n + 1}. ${s}`).join("\n")}` : "";
    return `**${t.title}**\n${t.summary}${steps}`;
  });
  const links = sanitizeLinks(hits.map((t) => ({ href: t.href, label: GUIDE_ROUTES.find((r) => r.href === t.href)?.label ?? t.title })));
  return { answer: parts.join("\n\n"), links, followUps: followUpsFor(hits[0]), via: "kb", note };
}

function followUpsFor(t: GuideTopic): string[] {
  const map: Record<string, string[]> = {
    "import-zerodha": ["What if I use another broker?", "What does 'open position' mean?", "What happens if I upload twice?"],
    dashboard: ["How do I switch to R-multiple?", "What is the Lens Score?", "How are charges calculated?"],
    "risk-rules": ["Where do I see my breaches?", "What is the Notebook for?", "How does the auto-tagger work?"],
    strategies: ["How do I log a missed trade?", "How do I attach a strategy to a trade?", "What is an R-multiple?"],
    "ai-coach": ["What is a session review?", "What does the weekly review give me?", "Why is the AI Coach off?"],
  };
  return map[t.id] ?? DEFAULT_FOLLOW_UPS;
}

// ─── Suggested questions per page ────────────────────────────────────────────

const SUGGESTIONS: [prefix: string, questions: string[]][] = [
  ["/dashboard", ["What do these dashboard numbers mean?", "How do I switch to R-multiple?", "What is the Lens Score?"]],
  ["/trades/import", ["How do I get my Zerodha tradebook?", "I use another broker. What now?", "What does 'open position' mean?"]],
  ["/trades/new", ["What do lots and lot size mean here?", "How are charges calculated?"]],
  ["/trades/tags", ["What does the auto-tagger look for?", "Should I accept all suggestions?"]],
  ["/trades", ["How do I review a trade?", "How do I find a specific trade?", "What is the Auto-tag button?"]],
  ["/journal", ["What is the Daily Journal?", "How do I add notes for a day?"]],
  ["/reports/compare", ["What can I compare?", "What is 'followed plan vs broke plan'?"]],
  ["/reports", ["How do I find my worst time of day?", "What does the filter bar do?", "How do I compare two sets?"]],
  ["/strategies", ["How do I create a strategy?", "How do I log a missed trade?"]],
  ["/notebook", ["How do I write a pre-market plan?", "What is the end-of-day reflection for?"]],
  ["/coach", ["What can I ask the AI Coach?", "What is a session review?", "Why is the AI Coach off?"]],
  ["/progress", ["How do I improve my Lens Score?", "What counts as a disciplined day?"]],
  ["/learn", ["Which lesson should I read first?", "What is an R-multiple?"]],
  ["/settings", ["How do I set risk rules?", "What does experience level change?", "How do I reset the demo data?"]],
];

export function suggestionsFor(path: string): string[] {
  const p = path.split("?")[0];
  for (const [prefix, qs] of SUGGESTIONS) if (p === prefix || p.startsWith(`${prefix}/`)) return qs;
  return DEFAULT_FOLLOW_UPS;
}

// ─── Guided tour (works without AI) ──────────────────────────────────────────

export type TourStep = { title: string; body: string; href: string; cta: string };

export const TOUR: TourStep[] = [
  { title: "Bring in your trades", body: "Everything starts with a tradebook. Upload your Zerodha CSV (or any broker's), or try the sample file. Charges are worked out for every trade.", href: "/trades/import", cta: "Open Import" },
  { title: "Read your Dashboard", body: "Net P&L after charges, win rate, profit factor, the equity curve and today's risk rules. Use the toggle to see ₹, % of capital, R or points.", href: "/dashboard", cta: "Open Dashboard" },
  { title: "Review a trade", body: "Open any trade and note your strategy, emotion, whether you followed your plan, and your stop-loss. This is what makes the reports meaningful.", href: "/trades", cta: "Open Trade Log" },
  { title: "Find your leaks", body: "Reports split your results by time of day, weekday, symbol, emotion and expiry day. Compare two sets side by side to see what habits cost you.", href: "/reports", cta: "Open Reports" },
  { title: "Set guardrails", body: "Write down your daily loss limit, max trades and a stop-after-losses rule, then plan your day in the Notebook.", href: "/settings", cta: "Open Settings" },
  { title: "Ask the AI Coach", body: "Ask questions about your own journal, get session and weekly reviews, and see your Lens Score and progress over time.", href: "/coach", cta: "Open AI Coach" },
];

// ─── Setup checklist ─────────────────────────────────────────────────────────

export type GuideProgress = {
  hasTrades: boolean;
  reviewedTrade: boolean;
  hasRiskRules: boolean;
  hasStrategy: boolean;
  hasPlan: boolean;
  usedCoach: boolean;
};

export const CHECKLIST: { key: keyof GuideProgress; title: string; hint: string; href: string }[] = [
  { key: "hasTrades", title: "Add your first trades", hint: "Import a tradebook or add one by hand", href: "/trades/import" },
  { key: "reviewedTrade", title: "Review a trade", hint: "Strategy, emotion, plan, stop-loss", href: "/trades" },
  { key: "hasRiskRules", title: "Set your risk rules", hint: "Daily loss, max trades, stop after losses", href: "/settings" },
  { key: "hasStrategy", title: "Create a strategy", hint: "A checklist for a setup you trade", href: "/strategies/new" },
  { key: "hasPlan", title: "Write a plan in the Notebook", hint: "Before the market opens", href: "/notebook" },
  { key: "usedCoach", title: "Try the AI Coach", hint: "Ask a question about your journal", href: "/coach" },
];

export function checklistDone(p: GuideProgress): number {
  return CHECKLIST.filter((c) => p[c.key]).length;
}
