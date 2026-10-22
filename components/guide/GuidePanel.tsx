"use client";

// The in-app Guide: a button on every screen that opens a side panel with
//   Start here: a getting-started checklist and a 6-step tour (work without AI)
//   Ask:        a chat that answers questions about the app and links to the right page
// Press ? to open or close it, Esc to close.

import clsx from "clsx";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Compass, Circle, Map as MapIcon, Send, Sparkles, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { askGuide, refreshGuideProgress } from "@/app/(app)/guide/actions";
import { RichText } from "@/components/coach/RichText";
import { CHECKLIST, checklistDone, type GuideLink, type GuideProgress, suggestionsFor, TOUR } from "@/lib/guide/guide";

type Msg = { id: number; role: "user" | "assistant"; content: string; links?: GuideLink[]; followUps?: string[]; via?: "ai" | "kb"; note?: string };

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
};

export function GuidePanel({ progress: initialProgress, aiEnabled }: { progress: GuideProgress; aiEnabled: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"start" | "ask">("start");
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false); // stops the "new here" pulse once they have looked
  const [progress, setProgress] = useState(initialProgress);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const done = checklistDone(progress);
  const total = CHECKLIST.length;
  const pulse = !opened && done < total;

  const toggle = useCallback((v?: boolean) => {
    setOpen((o) => {
      const next = v ?? !o;
      if (next) setOpened(true);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return toggle(false);
      if (e.key === "?" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(() => {
    if (open && tab === "ask") inputRef.current?.focus();
  }, [open, tab]);

  // The layout isn't re-fetched on in-app navigation, so ask for fresh checklist state each time the panel opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    refreshGuideProgress().then((p) => live && setProgress(p)).catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const go = (href: string) => {
    router.push(href);
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  };

  const send = async (q: string) => {
    const question = q.trim().slice(0, 400);
    if (!question || busy) return;
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { id: nextId.current++, role: "user", content: question }]);
    setInput("");
    setTab("ask");
    setBusy(true);
    try {
      const r = await askGuide({ question, path, history });
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: r.answer, links: r.links, followUps: r.followUps, via: r.via, note: r.note }]);
    } catch {
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: "Sorry, I couldn't answer just now. Try again, or open **Learn** for short lessons.", links: [{ label: "Learn", href: "/learn" }] }]);
    } finally {
      setBusy(false);
    }
  };

  const step = tourStep != null ? TOUR[tourStep] : null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <div className="fixed bottom-4 right-4 z-40">
          {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" aria-hidden />}
          <button
            type="button"
            onClick={() => toggle(true)}
            aria-label="Open the TradeLens Guide"
            className="btn-primary relative rounded-full px-4 py-3 shadow-xl"
          >
            <Compass size={20} /> <span className="hidden sm:inline">Guide</span>
          </button>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={() => toggle(false)} aria-hidden />}

      <aside
        role="dialog"
        aria-label="TradeLens Guide"
        aria-hidden={!open}
        inert={!open}
        className={clsx(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#0a0f16] shadow-2xl transition-transform duration-200 sm:w-[400px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="bg-felt flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg"><Compass size={20} /></span>
            <div>
              <div className="sign text-base leading-5">Guide</div>
              <div className="text-xs text-white/65">Find your way around TradeLens</div>
            </div>
          </div>
          <button type="button" onClick={() => toggle(false)} aria-label="Close the Guide" className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-white/10 text-sm" role="tablist">
          {(
            [
              ["start", `Start here (${done}/${total})`],
              ["ask", "Ask"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={clsx("px-3 py-2.5 font-medium transition-colors", tab === k ? "border-b-2 border-accent text-fg" : "border-b-2 border-transparent text-muted hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "start" ? (
            <div className="space-y-4 p-4">
              {/* Tour */}
              <div className="rounded-2xl border border-accent/30 bg-accent/[0.06] p-4">
                {step == null ? (
                  <>
                    <div className="flex items-center gap-2 font-medium"><MapIcon size={16} className="text-accent" /> 60-second tour</div>
                    <p className="mt-1 text-sm text-muted">Six stops: import, dashboard, trade review, reports, guardrails and the AI Coach.</p>
                    <button type="button" onClick={() => setTourStep(0)} className="btn-primary mt-3 px-4 py-1.5">Start the tour <ArrowRight size={16} /></button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="arcade text-[9px]">STOP {tourStep! + 1} OF {TOUR.length}</span>
                      <button type="button" onClick={() => setTourStep(null)} className="hover:text-fg">End tour</button>
                    </div>
                    <div className="mt-2 flex gap-1" aria-hidden>
                      {TOUR.map((_, i) => <span key={i} className={clsx("h-1 flex-1 rounded-full", i <= tourStep! ? "bg-accent" : "bg-white/15")} />)}
                    </div>
                    <h3 className="mt-3 font-medium">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => go(step.href)} className="btn-primary px-3 py-1.5">{step.cta} <ArrowRight size={15} /></button>
                      <button type="button" disabled={tourStep === 0} onClick={() => setTourStep((s) => Math.max(0, (s ?? 0) - 1))} aria-label="Previous stop" className="btn-ghost px-2 py-1.5"><ChevronLeft size={16} /></button>
                      {tourStep! < TOUR.length - 1 ? (
                        <button type="button" onClick={() => setTourStep((s) => (s ?? 0) + 1)} className="btn-ghost px-3 py-1.5">Next <ChevronRight size={16} /></button>
                      ) : (
                        <button type="button" onClick={() => setTourStep(null)} className="btn-ghost px-3 py-1.5">Finish</button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Checklist */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="arcade text-[10px] uppercase tracking-wide text-muted">Getting started</h3>
                  <span className="text-xs text-muted">{done} of {total} done</span>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
                  <div className="h-full bg-gradient-to-r from-profit to-accent transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
                </div>
                <ul className="space-y-1.5">
                  {CHECKLIST.map((c) => {
                    const ok = progress[c.key];
                    return (
                      <li key={c.key}>
                        <button type="button" onClick={() => go(c.href)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]">
                          <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", ok ? "bg-profit text-black" : "border border-white/25 text-transparent")}>
                            {ok ? <Check size={14} strokeWidth={3} /> : <Circle size={14} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={clsx("block text-sm font-medium", ok && "text-muted line-through")}>{c.title}</span>
                            <span className="block text-xs text-muted">{c.hint}</span>
                          </span>
                          <ArrowRight size={15} className="shrink-0 text-muted" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button type="button" onClick={() => setTab("ask")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.07]">
                <Sparkles size={18} className="shrink-0 text-accent" />
                <span className="text-sm"><span className="font-medium">Stuck on something?</span> <span className="text-muted">Ask the Guide in plain words.</span></span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-3 text-sm">
                Hi! I can show you around TradeLens and explain any feature. What would you like to do?
                <p className="mt-1.5 text-[11px] text-muted">{aiEnabled ? "AI-powered, grounded in TradeLens's own help." : "AI is off, so I answer from the built-in help."}</p>
              </div>

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestionsFor(path).map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-left text-xs hover:bg-accent/20">{s}</button>
                  ))}
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-accent/20 px-3.5 py-2 text-sm">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-2">
                    <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-3 text-sm">
                      <RichText text={m.content} />
                      {m.note && <p className="mt-2 text-[11px] italic text-muted">{m.note}</p>}
                    </div>
                    {m.links && m.links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.links.map((l) => (
                          <button key={l.href} type="button" onClick={() => go(l.href)} className="btn-primary px-3 py-1.5 text-xs">{l.label} <ArrowRight size={13} /></button>
                        ))}
                      </div>
                    )}
                    {m.followUps && m.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.followUps.map((f) => (
                          <button key={f} type="button" onClick={() => send(f)} className="rounded-full border border-white/15 px-2.5 py-1 text-left text-xs text-muted hover:bg-white/10 hover:text-fg">{f}</button>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted">{m.via === "ai" ? "AI answer" : "Built-in help"}</div>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-3 text-sm text-muted" aria-live="polite">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:240ms]" />
                  <span className="ml-1">Thinking…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="border-t border-white/10 p-3"
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setTab("ask")}
              maxLength={400}
              placeholder="Ask about any feature…"
              aria-label="Ask the Guide"
              className="input"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="btn-primary h-9 w-9 shrink-0 px-0">
              <Send size={16} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted">Press ? to open or close · Educational journaling tool. Not investment advice.</p>
        </form>
      </aside>
    </>
  );
}
