import "server-only";
// AI gateway for TradeLens: Google Gemini models through OpenRouter only.
// - Key from OPENROUTER_API_KEY, model from OPENROUTER_MODEL (never hardcoded, never logged)
// - Only "google/" model IDs are allowed
// - Every request is pinned to Google's own infrastructure (Vertex / AI Studio), no fallbacks
// - Structured JSON via response_format json_schema, validated again with Zod
// - 429 / 5xx retried with backoff (up to 3 times); 402 (no credits) stops immediately
// - Every call reports its model and cost from the response's usage field

import { z } from "zod";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-3.7-flash";

/** Added to every request body: Google's own infrastructure only, no fallback providers. */
export const GOOGLE_ONLY_PROVIDER = {
  only: ["google-vertex", "google-ai-studio"],
  allow_fallbacks: false,
  require_parameters: true,
} as const;

export type AiFailure = {
  ok: false;
  reason: "no_key" | "bad_model" | "credits" | "refusal" | "truncated" | "parse" | "auth" | "rate_limit" | "api";
  message: string;
};
/** cost = what the call cost in USD. With BYOK (a Google key attached to the OpenRouter account)
 * OpenRouter charges $0 and Google bills the upstream cost directly, so we report that instead. */
export type CallMeta = { model: string; cost: number | null; byok: boolean; promptTokens: number | null; completionTokens: number | null };
export type AiSuccess<T> = { ok: true; data: T; model: string; cost: number | null };
export type AiResult<T> = AiSuccess<T> | AiFailure;

export type Effort = "minimal" | "low" | "medium" | "high";

export function aiConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const googleModel = model.startsWith("google/");
  return { apiKey, model, enabled: Boolean(apiKey && googleModel) };
}

export function notConfigured(): AiFailure | null {
  const { apiKey, model } = aiConfig();
  if (!apiKey) return { ok: false, reason: "no_key", message: "Add OPENROUTER_API_KEY to .env (npm run set-key) and restart the app to enable the AI Coach." };
  if (!model.startsWith("google/")) {
    return { ok: false, reason: "bad_model", message: `OPENROUTER_MODEL must be a Google model ("google/…"); got "${model}".` };
  }
  return null;
}

// ─── Chat Completions types (OpenRouter's OpenAI-compatible format) ───────────

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_details?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ChatResponse = {
  id?: string;
  model?: string;
  choices?: {
    finish_reason?: string | null;
    native_finish_reason?: string | null;
    message?: { content?: string | null; tool_calls?: ToolCall[]; reasoning_details?: unknown[]; refusal?: string | null };
  }[];
  usage?: { cost?: number; is_byok?: boolean; cost_details?: { upstream_inference_cost?: number }; prompt_tokens?: number; completion_tokens?: number };
  error?: { code?: number; message?: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One POST to /chat/completions with the Google-only provider block.
 * Retries 429 and 5xx up to 3 times (honouring Retry-After); never retries 402.
 */
export async function chatCompletion(body: Record<string, unknown>): Promise<{ ok: true; res: ChatResponse; meta: CallMeta } | AiFailure> {
  const missing = notConfigured();
  if (missing) return missing;
  const { apiKey, model } = aiConfig() as { apiKey: string; model: string };

  const payload = JSON.stringify({ model, ...body, provider: GOOGLE_ONLY_PROVIDER });
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    let retryAfter: number | null = null;
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "TradeLens",
        },
        body: payload,
        signal: AbortSignal.timeout(120_000),
      });
      status = res.status;
      const json = (await res.json().catch(() => ({}))) as ChatResponse;
      if (res.ok && !json.error) {
        const meta: CallMeta = {
          model: json.model ?? model,
          cost: (json.usage?.is_byok ? json.usage?.cost_details?.upstream_inference_cost : json.usage?.cost) ?? null,
          byok: Boolean(json.usage?.is_byok),
          promptTokens: json.usage?.prompt_tokens ?? null,
          completionTokens: json.usage?.completion_tokens ?? null,
        };
        // Cost per call for the server log (the key itself is never logged).
        console.log(`[ai] ${json.id ?? "?"} · ${meta.model} · ${meta.promptTokens ?? "?"} in / ${meta.completionTokens ?? "?"} out · $${meta.cost ?? "?"}${meta.byok ? " (billed by Google via BYOK)" : ""}`);
        return { ok: true, res: json, meta };
      }
      status = json.error?.code ?? status;
      retryAfter = Number(res.headers.get("retry-after")) || null;
      if (status === 402) return { ok: false, reason: "credits", message: "OpenRouter says the account is out of credits (402). Add credits and try again." };
      if (status === 401 || status === 403) return { ok: false, reason: "auth", message: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in .env." };
      if (!(status === 429 || status >= 500)) {
        return { ok: false, reason: "api", message: `AI request failed (${status}): ${json.error?.message ?? "unknown error"}` };
      }
    } catch {
      status = 0; // network error or timeout: treat like a 5xx
    }
    if (attempt >= 3) {
      return status === 429
        ? { ok: false, reason: "rate_limit", message: "The AI service is rate limited right now. Try again in a minute." }
        : { ok: false, reason: "api", message: "Couldn't reach the AI service (Google via OpenRouter). Try again shortly." };
    }
    await sleep(retryAfter ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
}

/** Zod schema → JSON Schema for response_format (Zod 4 emits additionalProperties: false). */
function jsonSchemaFor(schema: z.ZodType) {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

/** One structured call: system + user text in, JSON validated against `schema` out. */
export async function callStructured<S extends z.ZodType>(opts: {
  name: string;
  system: string;
  user: string;
  schema: S;
  effort?: Effort;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  const r = await chatCompletion({
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: jsonSchemaFor(opts.schema) } },
    reasoning: { effort: opts.effort ?? "medium" },
    max_tokens: opts.maxTokens ?? 16000,
  });
  if (!r.ok) return r;

  const choice = r.res.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") {
    return { ok: false, reason: "refusal", message: "The AI declined this request. Try rephrasing, or ask about your own trading process." };
  }
  if (choice?.finish_reason === "length") return { ok: false, reason: "truncated", message: "The AI response was cut off. Please try again." };

  // Providers treat the schema as strict or as a strong hint, so validate it ourselves.
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice?.message?.content ?? "");
  } catch {
    return { ok: false, reason: "parse", message: "The AI returned something unexpected. Please try again." };
  }
  const valid = opts.schema.safeParse(parsed);
  if (!valid.success) return { ok: false, reason: "parse", message: "The AI's answer didn't match the expected format. Please try again." };
  return { ok: true, data: valid.data, model: r.meta.model, cost: r.meta.cost };
}
