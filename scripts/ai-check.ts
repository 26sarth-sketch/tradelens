// Smoke test for the AI gateway: one short text call through OpenRouter to a Google model.
// Run: npm run ai:check   (reads OPENROUTER_API_KEY / OPENROUTER_MODEL from .env)
import { aiConfig, chatCompletion } from "@/lib/ai/client";

(async () => {
  const { model, apiKey } = aiConfig();
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set. Run: npm run set-key");
    process.exit(1);
  }
  const r = await chatCompletion({
    messages: [{ role: "user", content: "In one sentence, what is a trading journal for?" }],
    reasoning: { effort: "low" },
    max_tokens: 1500,
  });
  if (!r.ok) {
    console.error(`Failed (${r.reason}): ${r.message}`);
    process.exit(1);
  }
  console.log(`Requested model: ${model}`);
  console.log(`Served by:       ${r.meta.model}`);
  console.log(`Reply:           ${r.res.choices?.[0]?.message?.content?.trim()}`);
  console.log(`Tokens:          ${r.meta.promptTokens} in / ${r.meta.completionTokens} out`);
  console.log(`Cost (usage):    $${r.meta.cost ?? "not reported"}`);
})();
