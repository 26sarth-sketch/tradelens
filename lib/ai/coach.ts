import "server-only";
// AI Coach features: build context → call the model → verify numbers → cache.
// Every call carries the compliance guardrail (prompts.ts) and the trader profile.

import type Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { istDateKey } from "../format";
import { loadReportTrades } from "../report-data";
import { aiConfig, callStructured, fallbackParams, getClient, mapError, notConfigured, type AiFailure } from "./client";
import { journalContext, sessionContext, weeklyContext } from "./context";
import { executeQuery, QUERY_TOOL, type QueryInput } from "./journal-query";
import { systemPrompt } from "./prompts";
import { FirstImportSchema, SessionSchema, WeeklySchema } from "./schemas";
import { verifyNumbers, type Verification } from "./verify";

export type ReportType = "FIRST_IMPORT" | "WEEKLY" | "SESSION";

export type StoredReport<T = unknown> = {
  output: T;
  verification: Verification;
  generatedAt: string;
  model: string;
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
    schema: FirstImportSchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, scope: `${data.period.from} → ${data.period.to}` };
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
    schema: WeeklySchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, scope: `${data.this_week.from} → ${data.this_week.to}` };
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
    schema: SessionSchema,
    effort: "medium",
  });
  if (!res.ok) return res;
  const report = { output: res.data, verification: verifyNumbers(res.data, data), generatedAt: new Date().toISOString(), model: res.model, scope: date };
  await store(userId, "SESSION", date, report);
  return { ok: true, report };
}

// ─── Ask your journal ─────────────────────────────────────────────────────────

export type ChatFacts = { queries: { filter: string; result: unknown }[]; verification: Verification };
export type ChatResult = { ok: true; answer: string; facts: ChatFacts } | AiFailure;

const MAX_TOOL_ROUNDS = 6;

export async function askJournal(userId: string, question: string): Promise<ChatResult> {
  const missing = notConfigured();
  if (missing) return missing;
  const { apiKey, model } = aiConfig() as { apiKey: string; model: string };

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
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: `${question}\n\n<DATA>\n${JSON.stringify(background)}\n</DATA>` },
  ];

  const queries: ChatFacts["queries"] = [];
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await getClient(apiKey).beta.messages.create({
        model,
        max_tokens: 16000,
        system: [{ type: "text", text: systemPrompt("chat", prof.level, prof.language), cache_control: { type: "ephemeral" } }],
        tools: [QUERY_TOOL as unknown as Anthropic.Beta.BetaTool],
        tool_choice: { type: "auto" },
        output_config: { effort: "medium" },
        messages,
        ...fallbackParams(model),
      });

      if (response.stop_reason === "refusal") {
        return { ok: false, reason: "refusal", message: "The coach declined that question. Ask about your own trades, habits or rules." };
      }
      // Keep the full assistant content (including thinking blocks) for the next round.
      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        const answer = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (!answer) return { ok: false, reason: "parse", message: "The coach didn't return an answer. Please try again." };
        const verification = verifyNumbers(answer, { background, queries: queries.map((q) => q.result) });
        return { ok: true, answer, facts: { queries, verification } };
      }

      // Run every requested query in code and return all results in one user message.
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
        if (tu.name !== QUERY_TOOL.name) {
          return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Unknown tool ${tu.name}` };
        }
        const result = executeQuery(trades, tu.input as Partial<QueryInput>, { strategies: prof.names, capital: prof.capital });
        queries.push({ filter: String(result.filter), result });
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) };
      });
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    return mapError(e);
  }
  return { ok: false, reason: "api", message: "The coach took too many steps. Try a simpler question." };
}
