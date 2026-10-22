"use client";

import clsx from "clsx";
import { Bot, ChevronDown, Loader2, Send, Trash2, User } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { ask, clearChat } from "@/app/(app)/coach/actions";
import type { ChatFacts } from "@/lib/ai/coach";
import { formatINR } from "@/lib/format";
import { RichText } from "./RichText";
import { VerificationBadge } from "./VerificationBadge";

export type ChatItem = { id: string; role: "user" | "assistant"; content: string; facts?: ChatFacts | null };

const SUGGESTIONS = [
  "What's my win rate on expiry days?",
  "Do I lose more money after 2 PM?",
  "How much did revenge trades cost me?",
  "Which strategy makes me the most money?",
  "How much have I paid in charges, and what % of my profit is that?",
  "Am I better when I follow my plan?",
];

type StatsPack = { trades: number; win_rate_pct: number; net_pnl_inr: number; expectancy_per_trade_inr: number };

/** The numbers the coach used: every query it ran, computed in code. */
function Facts({ facts }: { facts: ChatFacts }) {
  if (facts.queries.length === 0) return null;
  return (
    <details className="group mt-2 rounded-lg border border-border bg-surface-2/50 text-xs">
      <summary className="flex cursor-pointer items-center gap-1 px-2.5 py-1.5 text-muted">
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
        Numbers computed from your journal ({facts.queries.length} {facts.queries.length === 1 ? "query" : "queries"})
      </summary>
      <ul className="tabular divide-y divide-border px-2.5 pb-1.5">
        {facts.queries.map((q, i) => {
          const s = (q.result as { stats?: StatsPack }).stats;
          return (
            <li key={i} className="py-1.5">
              <div className="font-medium">{q.filter}</div>
              {s && (
                <div className="text-muted">
                  {s.trades} trades · {s.win_rate_pct}% wins · net <span className="money">{formatINR(s.net_pnl_inr, { signed: true })}</span> · <span className="money">{formatINR(s.expectancy_per_trade_inr, { signed: true })}</span>/trade
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function ChatPanel({ initial, aiEnabled }: { initial: ChatItem[]; aiEnabled: boolean }) {
  const [items, setItems] = useState<ChatItem[]>(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const nextId = useRef(0); // local ids for messages not yet reloaded from the server

  function send(q: string) {
    const question = q.trim();
    if (!question || pending) return;
    setError(undefined);
    setDraft("");
    const tempId = `u-${nextId.current++}`;
    setItems((xs) => [...xs, { id: tempId, role: "user", content: question }]);
    start(async () => {
      const res = await ask(question);
      if (res.ok) setItems((xs) => [...xs, { id: `a-${nextId.current++}`, role: "assistant", content: res.answer, facts: res.facts }]);
      else {
        setItems((xs) => xs.filter((x) => x.id !== tempId));
        setDraft(question);
        setError(res.message);
      }
    });
  }

  return (
    <section className="flex min-h-[520px] flex-col rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">Ask your journal</h2>
          <p className="text-xs text-muted">Answers use numbers computed from your own trades, never guesses.</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => start(async () => { await clearChat(); setItems([]); })}
            className="flex items-center gap-1 text-xs text-muted hover:text-loss"
          >
            <Trash2 size={13} /> Clear
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {items.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" disabled={!aiEnabled || pending} onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-sm text-muted hover:border-accent hover:text-fg disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((m) => (
          <div key={m.id} className={clsx("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
            <span className={clsx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-surface-2" : "bg-accent/15 text-accent")} aria-hidden>
              {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
            </span>
            <div className={clsx("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm", m.role === "user" ? "bg-accent/15" : "bg-surface-2")}>
              {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
              {m.facts && (
                <>
                  <Facts facts={m.facts} />
                  <div className="mt-2"><VerificationBadge v={m.facts.verification} /></div>
                </>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> Checking your journal…</div>
        )}
      </div>

      {error && <p className="mx-4 mb-2 rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          disabled={!aiEnabled}
          placeholder={aiEnabled ? "e.g. What's my win rate on expiry days?" : "AI Coach is off: add OPENROUTER_API_KEY to .env"}
          className="input flex-1"
          aria-label="Ask a question about your trading"
        />
        <button className="btn-primary" disabled={!aiEnabled || pending || !draft.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </section>
  );
}
