import clsx from "clsx";
import { KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ChatPanel, type ChatItem } from "@/components/coach/ChatPanel";
import { ReportCard } from "@/components/coach/ReportCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { aiConfig } from "@/lib/ai/client";
import { type ChatFacts, getCachedReport } from "@/lib/ai/coach";
import { weekStart } from "@/lib/ai/context";
import { DISCLAIMER_SHORT } from "@/lib/ai/guardrail";
import { db } from "@/lib/db";
import { formatDateIST, istDateKey } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "AI Coach" };

const TABS = [
  { key: "ask", label: "Ask your journal" },
  { key: "session", label: "Session review" },
  { key: "weekly", label: "Weekly review" },
  { key: "journal", label: "Journal analysis" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string; week?: string }> }) {
  const [sp, user] = await Promise.all([searchParams, getCurrentUser()]);
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "ask") as Tab;
  const { enabled, model } = aiConfig();
  const today = istDateKey(new Date());

  // Latest trading day with trades, for the session review default.
  const lastTrade = await db.trade.findFirst({ where: { userId: user.id }, orderBy: { entryAt: "desc" }, select: { entryAt: true } });
  const lastDay = lastTrade ? istDateKey(lastTrade.entryAt) : today;
  const sessionDate = sp.date && DAY.test(sp.date) ? sp.date : lastDay;
  const monday = sp.week && DAY.test(sp.week) ? weekStart(sp.week) : weekStart(lastDay);

  let body: React.ReactNode = null;
  if (tab === "ask") {
    const rows = await db.chatMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 40 });
    const initial: ChatItem[] = rows.map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
      facts: r.computedFacts ? (JSON.parse(r.computedFacts) as ChatFacts) : null,
    }));
    body = <ChatPanel initial={initial} aiEnabled={enabled} />;
  } else if (tab === "session") {
    const cached = await getCachedReport(user.id, "SESSION", sessionDate);
    body = (
      <div className="space-y-3">
        <DateNav base="/coach?tab=session&date=" value={sessionDate} prev={addDays(sessionDate, -1)} next={addDays(sessionDate, 1)} label={formatDateIST(sessionDate)} />
        <ReportCard key={sessionDate} type="SESSION" reportKey={sessionDate} initial={cached} aiEnabled={enabled}
          title="Session review" subtitle="Your pre-market plan and risk rules vs what you actually did." />
        <p className="text-xs text-muted">Edit the plan in the <Link href={`/notebook?date=${sessionDate}`} className="text-accent underline">Notebook</Link> before reviewing.</p>
      </div>
    );
  } else if (tab === "weekly") {
    const cached = await getCachedReport(user.id, "WEEKLY", monday);
    body = (
      <div className="space-y-3">
        <DateNav base="/coach?tab=weekly&week=" value={monday} prev={addDays(monday, -7)} next={addDays(monday, 7)} label={`Week of ${formatDateIST(monday)}`} />
        <ReportCard key={monday} type="WEEKLY" reportKey={monday} initial={cached} aiEnabled={enabled}
          title="Weekly review" subtitle="Top 3 strengths, top 3 mistakes and 3 rules for next week, compared with your previous 4 weeks." />
      </div>
    );
  } else {
    const cached = await getCachedReport(user.id, "FIRST_IMPORT", "all");
    body = (
      <ReportCard type="FIRST_IMPORT" reportKey="all" initial={cached} aiEnabled={enabled}
        title="What your data says" subtitle="A full read of your journal: what works, where money leaks, and what to do next." />
    );
  }

  return (
    <>
      <PageHeader
        title="AI Coach"
        description="A process and behaviour coach that knows your journal. It explains your numbers; it never gives tips or predictions."
      />

      {!enabled && (
        <div className="mb-4 flex gap-3 rounded-xl border border-warn/30 bg-warn/5 p-4 text-sm">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-warn" />
          <div>
            <p className="font-medium">Connect the AI Coach</p>
            <p className="text-muted">
              Add <code className="rounded bg-surface-2 px-1">ANTHROPIC_API_KEY=&quot;…&quot;</code> to the <code className="rounded bg-surface-2 px-1">.env</code> file in the project folder, then restart <code className="rounded bg-surface-2 px-1">npm run dev</code>. Everything else in TradeLens works without it.
            </p>
          </div>
        </div>
      )}

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={`/coach?tab=${t.key}`} scroll={false}
            className={clsx("whitespace-nowrap rounded-md px-3 py-1.5", t.key === tab ? "bg-accent text-accent-fg" : "text-muted hover:text-fg")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {body}

      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        <span>
          {DISCLAIMER_SHORT} The coach reviews your own trades and habits only. It will not recommend what to buy or sell, give price targets or predict markets (that requires SEBI registration).
          {enabled && model && <> Model: {model}.</>}
        </span>
      </p>
    </>
  );
}

function DateNav({ base, value, prev, next, label }: { base: string; value: string; prev: string; next: string; label: string }) {
  return (
    <form action="/coach" className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="tab" value={base.includes("weekly") ? "weekly" : "session"} />
      <Link href={`${base}${prev}`} className="btn-ghost py-1">←</Link>
      <span className="min-w-40 text-center font-medium">{label}</span>
      <Link href={`${base}${next}`} className="btn-ghost py-1">→</Link>
      <input type="date" name={base.includes("weekly") ? "week" : "date"} defaultValue={value} className="input w-auto py-1" aria-label="Pick a date" />
      <button className="btn-ghost py-1">Go</button>
    </form>
  );
}
