"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { EMOTIONS } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import { isDayKey } from "@/lib/format";

export type NotebookState = { ok?: boolean; error?: string; savedAt?: number };

const optPositive = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().positive().nullable());
const optInt = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable());

const PlanSchema = z.object({
  planMaxTrades: optInt,
  planMaxLoss: optPositive,
  planStrategyIds: z.string().default("[]"),
  planMood: z.preprocess((v) => (v === "" ? null : v), z.enum(EMOTIONS).nullable()),
  planNotes: z.string().trim().max(5000).default(""),
});

export async function savePlan(date: string, _prev: NotebookState, formData: FormData): Promise<NotebookState> {
  if (!isDayKey(date)) return { error: "Invalid date" };
  const parsed = PlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Max trades and max loss must be positive numbers." };
  const user = await getCurrentUser();
  // Keep only strategies that belong to this user.
  let ids: string[] = [];
  try {
    ids = (JSON.parse(parsed.data.planStrategyIds) as unknown[]).map(String);
  } catch {}
  const owned = await db.strategy.findMany({ where: { userId: user.id, id: { in: ids } }, select: { id: true } });
  const data = { ...parsed.data, planStrategyIds: JSON.stringify(owned.map((s) => s.id)) };
  await db.dailyJournal.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...data },
    update: data,
  });
  revalidatePath("/notebook");
  revalidatePath(`/journal/${date}`);
  revalidatePath("/journal");
  return { ok: true, savedAt: Date.now() };
}

const ReflectionSchema = z.object({
  eodWentWell: z.string().trim().max(5000).default(""),
  eodToImprove: z.string().trim().max(5000).default(""),
  eodRating: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(5).nullable()),
});

export async function saveReflection(date: string, _prev: NotebookState, formData: FormData): Promise<NotebookState> {
  if (!isDayKey(date)) return { error: "Invalid date" };
  const parsed = ReflectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Please check the reflection." };
  const user = await getCurrentUser();
  await db.dailyJournal.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath("/notebook");
  return { ok: true, savedAt: Date.now() };
}
