// Structured outputs for every AI feature. The model must return JSON matching
// these schemas (enforced via output_config.format); the UI renders them as cards.

import { z } from "zod";

const Insight = z.object({
  title: z.string().describe("Short headline, max ~8 words"),
  detail: z.string().describe("1–2 sentences in plain language for this trader's level"),
  evidence: z.string().describe("The specific numbers from the DATA that support this, copied exactly"),
});

export const FirstImportSchema = z.object({
  headline: z.string().describe("One sentence: the single most important thing their data says"),
  summary: z.string().describe("2–3 sentences overview of their trading so far"),
  strengths: z.array(Insight).describe("2–3 things they do well, with evidence"),
  leaks: z.array(Insight).describe("2–4 biggest money or discipline leaks, worst first, with evidence"),
  next_steps: z.array(z.string()).describe("Exactly 3 concrete PROCESS actions for the next 2 weeks"),
});
export type FirstImport = z.infer<typeof FirstImportSchema>;

export const WeeklySchema = z.object({
  headline: z.string().describe("One sentence verdict on the week"),
  strengths: z.array(Insight).describe("Exactly 3 strengths this week"),
  mistakes: z.array(Insight).describe("Exactly 3 mistakes this week, most costly first"),
  rules_for_next_week: z
    .array(z.object({ rule: z.string().describe("A specific, checkable process rule"), why: z.string().describe("Why, citing this week's numbers") }))
    .describe("Exactly 3 rules for next week"),
});
export type Weekly = z.infer<typeof WeeklySchema>;

export const SessionSchema = z.object({
  verdict: z.enum(["disciplined", "mixed", "undisciplined", "no_trades"]),
  headline: z.string().describe("One sentence summary of the session vs the plan"),
  rule_breaks: z
    .array(z.object({ rule: z.string(), what_happened: z.string().describe("What happened, with times and numbers from the DATA") }))
    .describe("Every broken plan item or risk rule; empty if none"),
  went_well: z.array(z.string()).describe("1–3 specific things that went well"),
  to_fix: z.array(z.string()).describe("1–3 specific things to fix"),
  tomorrow_focus: z.string().describe("One process rule to focus on tomorrow"),
});
export type Session = z.infer<typeof SessionSchema>;

export const TradeFeedbackSchema = z.object({
  verdict: z.enum(["good_process", "mixed", "poor_process"]).describe("Judge the PROCESS, not the P&L outcome"),
  headline: z.string(),
  went_well: z.array(z.string()).describe("0–2 points"),
  to_improve: z.array(z.string()).describe("1–3 points"),
  lesson: z.string().describe("One sentence lesson to carry forward"),
});
export type TradeFeedback = z.infer<typeof TradeFeedbackSchema>;

export const AutoTagSchema = z.object({
  suggestions: z
    .array(z.object({ tradeId: z.string(), tags: z.array(z.string()), reason: z.string() }))
    .describe("Only trades where a tag is clearly justified by the DATA"),
});
export type AutoTag = z.infer<typeof AutoTagSchema>;
