"use server";

import { revalidatePath } from "next/cache";
import { askJournal, type ChatResult, generateFirstImport, generateSession, generateTradeFeedback, generateWeekly, type ReportResult, type ReportType } from "@/lib/ai/coach";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { isDayKey } from "@/lib/format";


/** Generates (or regenerates) one AI report and caches it. */
export async function runReport(type: ReportType, key: string): Promise<ReportResult> {
  const user = await getCurrentUser();
  let res: ReportResult;
  if (type === "WEEKLY" && isDayKey(key)) res = await generateWeekly(user.id, key);
  else if (type === "SESSION" && isDayKey(key)) res = await generateSession(user.id, key);
  else if (type === "FIRST_IMPORT") res = await generateFirstImport(user.id, key);
  else if (type === "TRADE") {
    res = await generateTradeFeedback(user.id, key);
    revalidatePath(`/trades/${key}`);
  }
  else return { ok: false, reason: "no_data", message: "Unknown report." };
  revalidatePath("/coach");
  return res;
}

export async function ask(question: string): Promise<ChatResult> {
  const q = question.trim().slice(0, 500);
  if (!q) return { ok: false, reason: "parse", message: "Type a question first." };
  const user = await getCurrentUser();
  const res = await askJournal(user.id, q);
  if (res.ok) {
    await db.chatMessage.create({ data: { userId: user.id, role: "user", content: q } });
    await db.chatMessage.create({ data: { userId: user.id, role: "assistant", content: res.answer, computedFacts: JSON.stringify(res.facts) } });
  }
  return res;
}

export async function clearChat() {
  const user = await getCurrentUser();
  await db.chatMessage.deleteMany({ where: { userId: user.id } });
  revalidatePath("/coach");
}
