"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BROKERAGE_PLANS, type BrokeragePlanKey } from "@/config/market";
import { db } from "@/lib/db";
import { recomputeAllCharges } from "@/lib/recompute";
import { recomputeBreaches } from "@/lib/rule-store";
import { LEVELS } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import { seedDemo } from "@/prisma/seed-core";

export type SettingsState = { ok?: boolean; error?: string; message?: string; savedAt?: number };

const optPositive = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().positive().nullable());
const optInt = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable());

const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  level: z.enum(LEVELS),
  capital: z.coerce.number().positive("Capital must be more than 0").max(1e10),
  language: z.enum(["EN", "HINGLISH"]),
  broker: z.string().trim().max(40).default(""),
  brokeragePlan: z.enum(Object.keys(BROKERAGE_PLANS) as [BrokeragePlanKey, ...BrokeragePlanKey[]]),
});

export async function saveProfile(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  const user = await getCurrentUser();
  const planChanged = user.profile?.brokeragePlan !== v.brokeragePlan;

  await db.user.update({ where: { id: user.id }, data: { name: v.name } });
  await db.traderProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, level: v.level, capital: v.capital, language: v.language, broker: v.broker || null, brokeragePlan: v.brokeragePlan, onboarded: true },
    update: { level: v.level, capital: v.capital, language: v.language, broker: v.broker || null, brokeragePlan: v.brokeragePlan },
  });

  let message = "Profile saved.";
  if (planChanged) {
    const n = await recomputeAllCharges(user.id, v.brokeragePlan);
    await recomputeBreaches(user.id);
    message = `Profile saved. Charges recalculated on ${n} trades for the new brokerage plan.`;
  }
  revalidatePath("/", "layout");
  return { ok: true, message, savedAt: Date.now() };
}

const RulesSchema = z.object({
  maxDailyLoss: optPositive,
  maxTradesPerDay: optInt,
  maxLossPerTrade: optPositive,
  maxConsecutiveLosses: optInt,
  noTradeAfter: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{2}:\d{2}$/).nullable()),
});

export async function saveRiskRules(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = RulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Limits must be positive numbers (leave a box empty to turn a rule off)." };
  const user = await getCurrentUser();
  await db.traderProfile.update({ where: { userId: user.id }, data: parsed.data });
  const n = await recomputeBreaches(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: `Rules saved. History re-checked: ${n} breaches.`, savedAt: Date.now() };
}

export async function recomputeCharges(): Promise<SettingsState> {
  const user = await getCurrentUser();
  const n = await recomputeAllCharges(user.id, (user.profile?.brokeragePlan ?? "DISCOUNT") as BrokeragePlanKey);
  await recomputeBreaches(user.id);
  revalidatePath("/", "layout");
  return { ok: true, message: `Charges recalculated on ${n} trades using the current rates in config/market.ts.`, savedAt: Date.now() };
}

/** Wipes everything and reloads the demo journal (same code as `npm run db:seed`, run in-process). */
export async function resetDemoData(): Promise<SettingsState> {
  try {
    await seedDemo(db);
  } catch (e) {
    return { error: `Reset failed: ${e instanceof Error ? e.message.split("\n")[0] : "unknown error"}` };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Demo data reloaded.", savedAt: Date.now() };
}
