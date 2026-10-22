"use server";

import { headers } from "next/headers";
import { askGuideAI, type GuideTurn } from "@/lib/guide/ask";
import { type GuideProgress, type GuideReply, kbAnswer } from "@/lib/guide/guide";
import { createLimiter } from "@/lib/guide/limit";
import { getGuideProgress } from "@/lib/guide/progress";
import { getCurrentUser } from "@/lib/user";

// Brakes for the public demo: a few AI answers per visitor, and a cap across all visitors.
// Over the limit the Guide keeps answering from the built-in help, so it never just refuses.
const perVisitor = createLimiter({ max: 15, windowMs: 10 * 60_000 });
const overall = createLimiter({ max: 150, windowMs: 60 * 60_000 });

const MAX_QUESTION = 400;

export async function askGuide(input: { question: string; path: string; history: GuideTurn[] }): Promise<GuideReply> {
  const question = String(input?.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) return kbAnswer("");
  const path = /^\/[\w\-/?=&]{0,100}$/.test(String(input?.path ?? "")) ? input.path : "/dashboard";
  const history = (Array.isArray(input?.history) ? input.history : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  if (!perVisitor.allow(ip, now) || !overall.allow("all", now)) {
    return kbAnswer(question, "You've asked a lot in a short time, so this answer comes from the built-in help. The AI is back in a few minutes.");
  }

  const user = await getCurrentUser();
  const progress = await getGuideProgress(user.id);
  try {
    return await askGuideAI({ question, path, history, progress, level: user.profile?.level ?? "BEGINNER", language: user.profile?.language ?? "EN" });
  } catch {
    return kbAnswer(question, "Something went wrong with the AI, so this answer comes from the built-in help.");
  }
}

/** Fresh checklist state, fetched when the panel opens so it reflects what was done since the page loaded. */
export async function refreshGuideProgress(): Promise<GuideProgress> {
  const user = await getCurrentUser();
  return getGuideProgress(user.id);
}
