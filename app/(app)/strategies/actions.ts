"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { fromIST, isDayKey } from "@/lib/format";
import { getCurrentUser } from "@/lib/user";

const ruleList = (prefix: string) =>
  z
    .array(z.object({ id: z.string().regex(new RegExp(`^${prefix}\\d{1,3}$`)), text: z.string().trim().min(1).max(200) }))
    .max(15)
    .refine((rs) => new Set(rs.map((r) => r.id)).size === rs.length, "Duplicate rule ids");

const StrategySchema = z.object({
  name: z.string().trim().min(1, "Give your strategy a name").max(60),
  description: z.string().trim().max(1000).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffc83d"),
  entryRules: ruleList("e"),
  exitRules: ruleList("x"),
  riskRules: ruleList("r"),
});

export type StrategyFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function saveStrategy(id: string | null, _prev: StrategyFormState, formData: FormData): Promise<StrategyFormState> {
  let rules: Record<string, unknown>;
  try {
    rules = {
      entryRules: JSON.parse(String(formData.get("entryRules") ?? "[]")),
      exitRules: JSON.parse(String(formData.get("exitRules") ?? "[]")),
      riskRules: JSON.parse(String(formData.get("riskRules") ?? "[]")),
    };
  } catch {
    return { error: "Couldn't read the rules. Please try again." };
  }
  const parsed = StrategySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    color: formData.get("color") ?? undefined,
    ...rules,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const user = await getCurrentUser();
  const data = {
    name: v.name,
    description: v.description,
    color: v.color,
    entryRules: JSON.stringify(v.entryRules),
    exitRules: JSON.stringify(v.exitRules),
    riskRules: JSON.stringify(v.riskRules),
  };

  let savedId = id;
  if (id) {
    const res = await db.strategy.updateMany({ where: { id, userId: user.id }, data });
    if (res.count === 0) return { error: "Strategy not found." };
  } else {
    savedId = (await db.strategy.create({ data: { ...data, userId: user.id } })).id;
  }
  revalidatePath("/strategies");
  redirect(`/strategies/${savedId}`);
}

export async function deleteStrategy(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  // Trades keep their data; their strategy link is cleared (onDelete: SetNull).
  await db.strategy.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/strategies");
  redirect("/strategies");
}

// ─── Missed trades ────────────────────────────────────────────────────────────

const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());

const MissedSchema = z.object({
  date: z.string().refine(isDayKey, "Pick a date"),
  strategyId: z.string().optional(),
  symbol: z.string().trim().min(1, "Which symbol?").max(40),
  reason: z.string().trim().max(300).default(""),
  hypotheticalPnl: optNum,
  notes: z.string().trim().max(2000).default(""),
});

export type MissedState = { ok?: boolean; error?: string; savedAt?: number };

export async function addMissedTrade(_prev: MissedState, formData: FormData): Promise<MissedState> {
  const parsed = MissedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const v = parsed.data;
  const user = await getCurrentUser();
  const strategyId = v.strategyId
    ? ((await db.strategy.findFirst({ where: { id: v.strategyId, userId: user.id }, select: { id: true } }))?.id ?? null)
    : null;
  await db.missedTrade.create({
    data: {
      userId: user.id,
      strategyId,
      date: fromIST(v.date, "12:00"),
      symbol: v.symbol.toUpperCase(),
      reason: v.reason,
      hypotheticalPnl: v.hypotheticalPnl ?? null,
      notes: v.notes,
    },
  });
  revalidatePath("/strategies");
  if (strategyId) revalidatePath(`/strategies/${strategyId}`);
  return { ok: true, savedAt: Date.now() };
}

export async function deleteMissedTrade(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  await db.missedTrade.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/strategies");
}
