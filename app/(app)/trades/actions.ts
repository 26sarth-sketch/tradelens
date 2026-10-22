"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BrokeragePlanKey } from "@/config/market";
import { db } from "@/lib/db";
import { fromIST, isDayKey } from "@/lib/format";
import { buildTradeData, computeR } from "@/lib/trades";
import { EMOTIONS, EXCHANGES, SEGMENTS } from "@/lib/types";
import { deleteImage, saveImage } from "@/lib/uploads";
import { recomputeBreaches } from "@/lib/rule-store";
import { getCurrentUser } from "@/lib/user";

const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const day = z.string().refine(isDayKey, "Pick a date");

const ManualTrade = z
  .object({
    segment: z.enum(SEGMENTS),
    exchange: z.enum(EXCHANGES),
    underlying: z.string().trim().min(1, "Enter a symbol").max(30),
    optionType: z.enum(["CE", "PE"]).optional(),
    strike: optNum,
    expiry: z.string().optional(),
    lotSize: optNum,
    direction: z.enum(["LONG", "SHORT"]),
    qty: z.coerce.number().positive("Quantity must be more than 0"),
    entryDate: day,
    exitDate: z.string().optional(),
    entryTime: time,
    exitTime: time,
    avgEntry: z.coerce.number().positive("Enter the entry price"),
    avgExit: z.coerce.number().positive("Enter the exit price"),
    plannedSL: optNum,
    plannedTarget: optNum,
    notes: z.string().max(5000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.segment === "OPT") {
      if (!v.strike) ctx.addIssue({ code: "custom", path: ["strike"], message: "Enter the strike" });
      if (!v.optionType) ctx.addIssue({ code: "custom", path: ["optionType"], message: "Pick CE or PE" });
    }
    if ((v.segment === "OPT" || v.segment === "FUT") && !v.expiry) {
      ctx.addIssue({ code: "custom", path: ["expiry"], message: "Pick the expiry" });
    }
  });

export type CreateTradeState = { error?: string; fieldErrors?: Record<string, string> };

export async function createTrade(_prev: CreateTradeState, formData: FormData): Promise<CreateTradeState> {
  const parsed = ManualTrade.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;

  const entryAt = fromIST(v.entryDate, v.entryTime);
  const exitDay = v.segment === "EQ_DELIVERY" && v.exitDate ? v.exitDate : v.entryDate;
  const exitAt = fromIST(exitDay, v.exitTime);
  if (exitAt < entryAt) return { error: "Exit can't be before entry.", fieldErrors: { exitTime: "Before entry" } };

  const user = await getCurrentUser();
  const data = buildTradeData(
    {
      ...v,
      expiry: v.expiry ? fromIST(v.expiry, "15:30") : null,
      entryAt,
      exitAt,
    },
    user.profile?.brokeragePlan as BrokeragePlanKey | undefined,
  );

  const trade = await db.trade.create({
    data: { ...data, userId: user.id, source: "MANUAL", notes: v.notes ?? "" },
  });

  await recomputeBreaches(user.id);
  revalidatePath("/trades");
  redirect(`/trades/${trade.id}?created=1`);
}

export async function deleteTrade(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  const trade = await db.trade.findFirst({ where: { id, userId: user.id }, select: { screenshot: true } });
  await db.trade.deleteMany({ where: { id, userId: user.id } });
  await deleteImage(trade?.screenshot);
  await recomputeBreaches(user.id);
  revalidatePath("/trades");
  redirect("/trades");
}

// ─── Review (editable trade fields) ───────────────────────────────────────────

const ReviewSchema = z
  .object({
    strategyId: z.string().optional(),
    tags: z.string().default("[]"),
    checkedRules: z.string().default("[]"),
    emotionBefore: z.enum(EMOTIONS).or(z.literal("")).optional(),
    emotionAfter: z.enum(EMOTIONS).or(z.literal("")).optional(),
    followedPlan: z.enum(["yes", "no", ""]).optional(),
    plannedSL: optNum,
    plannedTarget: optNum,
    highPrice: optNum,
    lowPrice: optNum,
    notes: z.string().max(10_000).optional(),
    removeScreenshot: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.highPrice != null && v.lowPrice != null && v.highPrice < v.lowPrice) {
      ctx.addIssue({ code: "custom", path: ["highPrice"], message: "High can't be below low" });
    }
  });

export type ReviewState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; savedAt?: number };

function parseJsonList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function updateTradeReview(id: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const { screenshot, ...fields } = Object.fromEntries(formData);
  const parsed = ReviewSchema.safeParse(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  const v = parsed.data;
  const user = await getCurrentUser();
  const trade = await db.trade.findFirst({ where: { id, userId: user.id } });
  if (!trade) return { error: "Trade not found." };

  // Strategy must belong to this user.
  const strategyId = v.strategyId
    ? ((await db.strategy.findFirst({ where: { id: v.strategyId, userId: user.id }, select: { id: true } }))?.id ?? null)
    : null;

  // Screenshot: upload new (replacing old), remove, or keep.
  let screenshotName = trade.screenshot;
  if (screenshot instanceof File && screenshot.size > 0) {
    const saved = await saveImage(screenshot);
    if ("error" in saved) return { error: "Please fix the highlighted fields.", fieldErrors: { screenshot: saved.error } };
    await deleteImage(trade.screenshot);
    screenshotName = saved.name;
  } else if (v.removeScreenshot === "1") {
    await deleteImage(trade.screenshot);
    screenshotName = null;
  }

  const plannedSL = v.plannedSL ?? null;
  const plannedTarget = v.plannedTarget ?? null;
  const r = computeR({ avgEntry: trade.avgEntry, qty: trade.qty, plannedSL, plannedTarget }, trade.netPnl);

  const tagNames = [...new Set(parseJsonList(v.tags).map((t) => t.trim()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 30));
  const checkedRules = parseJsonList(v.checkedRules);

  await db.$transaction(async (tx) => {
    await tx.trade.update({
      where: { id },
      data: {
        strategyId,
        emotionBefore: v.emotionBefore || null,
        emotionAfter: v.emotionAfter || null,
        followedPlan: v.followedPlan === "yes" ? true : v.followedPlan === "no" ? false : null,
        plannedSL,
        plannedTarget,
        plannedR: r.plannedR,
        rMultiple: r.rMultiple,
        highPrice: v.highPrice ?? null,
        lowPrice: v.lowPrice ?? null,
        notes: v.notes ?? "",
        screenshot: screenshotName,
      },
    });

    // Tags: replace the user's accepted tags; leave pending AI suggestions alone.
    const tagIds: string[] = [];
    for (const name of tagNames) {
      const tag = await tx.tag.upsert({
        where: { userId_name: { userId: user.id, name } },
        create: { userId: user.id, name },
        update: {},
      });
      tagIds.push(tag.id);
    }
    await tx.tradeTag.deleteMany({ where: { tradeId: id, accepted: true, tagId: { notIn: tagIds } } });
    for (const tagId of tagIds) {
      await tx.tradeTag.upsert({
        where: { tradeId_tagId: { tradeId: id, tagId } },
        create: { tradeId: id, tagId },
        update: { accepted: true },
      });
    }

    // Playbook checklist for the chosen strategy only.
    await tx.tradeRuleCheck.deleteMany({ where: { tradeId: id, ...(strategyId ? { strategyId: { not: strategyId } } : {}) } });
    if (strategyId) {
      await tx.tradeRuleCheck.upsert({
        where: { tradeId_strategyId: { tradeId: id, strategyId } },
        create: { tradeId: id, strategyId, checkedRules: JSON.stringify(checkedRules) },
        update: { checkedRules: JSON.stringify(checkedRules) },
      });
    }
  });

  revalidatePath(`/trades/${id}`);
  revalidatePath("/trades");
  return { ok: true, savedAt: Date.now() };
}
