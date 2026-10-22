import "server-only";
// AI Coach features: build context → call the model → verify numbers → cache.
// Every call carries the compliance guardrail (prompts.ts) and the trader profile.

import { db } from "../db";
import { istDateKey } from "../format";
import { loadReportTrades } from "../report-data";
import { callStructured, chatCompletion, type AiFailure, type ChatMessage, notConfigured } from "./client";
import { journalContext, sessionContext, tradeContext, weeklyContext } from "./context";
import { executeQuery, QUERY_TOOL, QUERY_TOOL_SPEC, type QueryInput } from "./journal-query";
import { systemPrompt } from "./prompts";
import { FirstImportSchema, SessionSchema, TradeFeedbackSchema, WeeklySchema } from "./schemas";
import { verifyNumbers, type Verification } from "./verify";

export type ReportType = "FIRST_IMPORT" | "WEEKLY" | "SESSION" | "TRADE";

export type StoredReport<T = unknown> = {
  output: T;
  verification: Verification;
  generatedAt: string;
  model: string;
  /** USD cost of the call from OpenRouter's usage field, when reported. */
  cost?: number | null;
  scope: string;
};

export type ReportResult<T = unknown> = { ok: true; report: StoredReport<T> } | AiFailure | { ok: false; reason: "no_data"; message: string };

export async function getCachedReport<T>(userId: string, type: ReportType, key: string): Promise<StoredReport<T> | null> {
  const row = await db.aiReport.findUnique({ where: { userId_type_key: { userId, type, key } } });
  return row ? (JSON.parse(row.json) as StoredReport<T>) : null;
}

async function store(userId: string, type: ReportType, key: string, report: StoredReport) {
  const json = JSON.stringify(report);
  await db.aiReport.upsert({
    where: { userId_type_key: { userId, type, key } },
    create: { userId, type, key, json, model: report.model },
    update: { json, model: report.model, createdAt: new Date() },
  });
}

const userMessage = (intro: string, data: unknown) => `${intro}\n\n<DATA>\n${JSON.stringify(data)}\n</DATA>`;

/** "Here's what your data says": runs on the whole journal after an import. */
export async function generateFirstImport(userId: string, key: string): Promise<ReportResult> {
  const missing = notConfigured();
  if (missing) return missing;
  const { prof, data } = await journalContext(userId);
  if (!data) return { ok: false, reason: "no_data", message: "Import some trades first." };
  const res = await callStructured({
    system: systemPrompt("first_import", prof.level, prof.language),
    user: userMessage("Analyse my trading journal.", data),
    name: "first_import_analysis",
    schema: FirstImportSchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, cost: res.cost, scope: `${data.period.from} → ${data.period.to}` };
  await store(userId, "FIRST_IMPORT", key, report);
  return { ok: true, report };
}

export async function generateWeekly(userId: string, monday: string): Promise<ReportResult> {
  const missing = notConfigured();
  if (missing) return missing;
  const { prof, data } = await weeklyContext(userId, monday);
  if (!data) return { ok: false, reason: "no_data", message: "No trades in this week." };
  const res = await callStructured({
    system: systemPrompt("weekly", prof.level, prof.language),
    user: userMessage(`Review my trading week starting ${monday}.`, data),
    name: "weekly_review",
    schema: WeeklySchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, cost: res.cost, scope: `${data.this_week.from} → ${data.this_week.to}` };
  await store(userId, "WEEKLY", monday, report);
  return { ok: true, report };
}

export async function generateSession(userId: string, date: string): Promise<ReportResult> {
  const missing = notConfigured();
  if (missing) return missing;
  const { prof, data } = await sessionContext(userId, date);
  const res = await callStructured({
    system: systemPrompt("session", prof.level, prof.language),
    user: userMessage(`Review my trading session on ${date}.`, data),
    name: "session_review",
    schema: SessionSchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, cost: res.cost, scope: date };
  await store(userId, "SESSION", date, report);
  return { ok: true, report };
}

/** Process feedback on one trade (judges the process, not the outcome). */
export async function generateTradeFeedback(userId: string, tradeId: string): Promise<ReportResult> {
  const missing = notConfigured();
  if (missing) return missing;
  const { prof, data } = await tradeContext(userId, tradeId);
  if (!data) return { ok: false, reason: "no_data", message: "Trade not found." };
  const res = await callStructured({
    system: systemPrompt("trade", prof.level, prof.language),
    user: userMessage("Give me feedback on this trade.", data),
    name: "trade_feedback",
    schema: TradeFeedbackSchema,
    effort: "low",
    maxTokens: 8000,
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, cost: res.cost, scope: `${data.trade.symbol} · ${data.trade.date}` };
  await store(userId, "TRADE", tradeId, report);
  return { ok: true, report };
}

// ─── Ask your journal ─────────────────────────────────────────────────────────

export type ChatFacts = { queries: { filter: string; result: unknown }[]; verification: Verification; model?: string; cost?: number };
export type ChatResult = { ok: true; answer: string; facts: ChatFacts } | AiFailure;

const MAX_TOOL_ROUNDS = 6;

export async function askJournal(userId: string, question: string): Promise<ChatResult> {
  const missing = notConfigured();
  if (missing) return missing;

  const { prof, data } = await journalContext(userId);
  const trades = await loadReportTrades(userId);
  const tags = await db.tag.findMany({ where: { userId }, select: { name: true } });
  const background = data
    ? {
        trader: data.trader,
        today_ist: istDateKey(new Date()),
        journal_period: data.period,
        overall: data.overall,
        strategy_names: Object.values(prof.names),
        tag_names: tags.map((t) => t.name),
      }
    : { trader: prof.trader, today_ist: istDateKey(new Date()), note: "The journal has no trades yet." };

  // Recent conversation as plain text turns (the model re-queries numbers as needed).
  const history = await db.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 });
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt("chat", prof.level, prof.language) },
    ...history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: `${question}\n\n<DATA>\n${JSON.stringify(background)}\n</DATA>` },
  ];

  const queries: ChatFacts["queries"] = [];
  let cost = 0;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const r = await chatCompletion({
      messages,
      tools: [QUERY_TOOL_SPEC],
      tool_choice: round === MAX_TOOL_ROUNDS ? "none" : "auto",
      reasoning: { effort: "medium" },
      max_tokens: 16000,
    });
    if (!r.ok) return r;
    cost += r.meta.cost ?? 0;

    const choice = r.res.choices?.[0];
    const msg = choice?.message;
    if (msg?.refusal || choice?.finish_reason === "content_filter") {
      return { ok: false, reason: "refusal", message: "The coach declined that question. Ask about your own trades, habits or rules." };
    }
    // Echo the assistant turn back unchanged, including Gemini's reasoning_details,
    // which reasoning models need to continue after tool results.
    messages.push({ role: "assistant", content: msg?.content ?? null, tool_calls: msg?.tool_calls, reasoning_details: msg?.reasoning_details });

    const calls = msg?.tool_calls ?? [];
    if (calls.length === 0) {
      const answer = (msg?.content ?? "").trim();
      if (!answer) return { ok: false, reason: "parse", message: "The coach didn't return an answer. Please try again." };
      const verification = verifyNumbers(answer, { background, queries: queries.map((q) => q.result) });
      return { ok: true, answer, facts: { queries, verification, model: r.meta.model, cost } };
    }

    // Run every requested query in code; one tool message per call.
    for (const call of calls) {
      let content: string;
      if (call.function.name !== QUERY_TOOL.name) {
        content = JSON.stringify({ error: `Unknown tool ${call.function.name}` });
      } else {
        let input: Partial<QueryInput> = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          content = JSON.stringify({ error: "Arguments were not valid JSON. Call the tool again with valid JSON." });
          messages.push({ role: "tool", tool_call_id: call.id, content });
          continue;
        }
        const result = executeQuery(trades, input, { strategies: prof.names, capital: prof.capital });
        queries.push({ filter: String(result.filter), result });
        content = JSON.stringify(result);
      }
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return { ok: false, reason: "api", message: "The coach took too many steps. Try a simpler question." };
}
