"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BrokeragePlanKey } from "@/config/market";
import { db } from "@/lib/db";
import { fromIST } from "@/lib/format";
import { buildTradeData } from "@/lib/trades";
import { EXCHANGES, SEGMENTS } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";

const optNum = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().optional());
const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

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

  revalidatePath("/trades");
  redirect(`/trades/${trade.id}?created=1`);
}

export async function deleteTrade(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  await db.trade.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/trades");
  redirect("/trades");
}
