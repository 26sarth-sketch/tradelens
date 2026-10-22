import "server-only";
// Thin wrapper over the Anthropic SDK for every AI feature in TradeLens.
// - API key and model come from ANTHROPIC_API_KEY / ANTHROPIC_MODEL (never hardcoded)
// - Structured JSON output via output_config.format (zod schemas in ./schemas.ts)
// - Server-side refusal fallbacks ("default" mode) on models that support them
// - Errors are returned, not thrown, so the UI can always render a helpful card

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export type AiFailure = {
  ok: false;
  reason: "no_key" | "no_model" | "refusal" | "truncated" | "parse" | "auth" | "rate_limit" | "api";
  message: string;
};
export type AiSuccess<T> = { ok: true; data: T; model: string };
export type AiResult<T> = AiSuccess<T> | AiFailure;

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Models that accept `fallbacks: "default"` (beta server-side-fallback-2026-07-01). */
const FALLBACK_MODELS = ["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"];

export function aiConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || null;
  return { apiKey, model, enabled: Boolean(apiKey && model) };
}

let client: Anthropic | null = null;
function getClient(apiKey: string) {
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return client;
}

export function notConfigured(): AiFailure | null {
  const { apiKey, model } = aiConfig();
  if (!apiKey) return { ok: false, reason: "no_key", message: "Add ANTHROPIC_API_KEY to .env and restart the app to enable the AI Coach." };
  if (!model) return { ok: false, reason: "no_model", message: "Set ANTHROPIC_MODEL in .env (e.g. claude-opus-5-5)." };
  return null;
}

/** Fallback params for models that support server-side refusal fallbacks. */
export function fallbackParams(model: string) {
  return FALLBACK_MODELS.includes(model)
    ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
    : {};
}

export function mapError(e: unknown): AiFailure {
  if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: "auth", message: "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env." };
  if (e instanceof Anthropic.RateLimitError) return { ok: false, reason: "rate_limit", message: "The AI service is busy (rate limited). Try again in a minute." };
  if (e instanceof Anthropic.NotFoundError) return { ok: false, reason: "api", message: "Model not found. Check ANTHROPIC_MODEL in .env." };
  if (e instanceof Anthropic.APIError) return { ok: false, reason: "api", message: `AI service error (${e.status ?? "network"}). Please try again.` };
  return { ok: false, reason: "api", message: "Couldn't reach the AI service. Check your connection and try again." };
}

/** One structured call: system + user text in, validated JSON out. */
export async function callStructured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort?: Effort;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  const missing = notConfigured();
  if (missing) return missing;
  const { apiKey, model } = aiConfig() as { apiKey: string; model: string };

  try {
    const response = await getClient(apiKey).beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      // Stable system prompt first so repeated calls can reuse the prompt cache.
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? "medium" },
      ...fallbackParams(model),
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "refusal", message: "The AI declined this request. Try rephrasing, or ask about your own trading process." };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "truncated", message: "The AI response was cut off. Please try again." };
    }
    if (!response.parsed_output) {
      return { ok: false, reason: "parse", message: "The AI returned something unexpected. Please try again." };
    }
    return { ok: true, data: response.parsed_output as z.infer<S>, model: response.model };
  } catch (e) {
    return mapError(e);
  }
}

export { getClient };
