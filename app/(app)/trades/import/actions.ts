"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BrokeragePlanKey } from "@/config/market";
import { db } from "@/lib/db";
import { commitImport, type ImportPreview, previewImport } from "@/lib/import/service";
import type { ParseResult } from "@/lib/import/types";
import { NotZerodhaError, parseZerodhaTradebook } from "@/lib/import/zerodha";
import { getCurrentUser } from "@/lib/user";

const MAX_BYTES = 10 * 1024 * 1024;

export type PreviewState = { error?: string; preview?: ImportPreview; filename?: string };

async function readCsv(formData: FormData): Promise<{ text: string; filename: string } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 10 MB. Split it by date range." };
  return { text: await file.text(), filename: file.name };
}

function parse(text: string): ParseResult | { error: string } {
  try {
    return parseZerodhaTradebook(text);
  } catch (e) {
    if (e instanceof NotZerodhaError) return { error: e.message };
    throw e;
  }
}

export async function previewZerodha(formData: FormData): Promise<PreviewState> {
  const csv = await readCsv(formData);
  if ("error" in csv) return csv;
  const parsed = parse(csv.text);
  if ("error" in parsed) return parsed;
  const user = await getCurrentUser();
  const preview = await previewImport(parsed, user.profile?.brokeragePlan as BrokeragePlanKey | undefined);
  return { preview, filename: csv.filename };
}

export async function commitZerodha(formData: FormData): Promise<{ error?: string }> {
  const csv = await readCsv(formData);
  if ("error" in csv) return csv;
  const parsed = parse(csv.text);
  if ("error" in parsed) return parsed;
  const user = await getCurrentUser();
  const batch = await commitImport({
    userId: user.id,
    source: "ZERODHA",
    filename: csv.filename,
    parsed,
    plan: user.profile?.brokeragePlan as BrokeragePlanKey | undefined,
  });
  revalidatePath("/trades");
  redirect(`/trades/import/${batch.id}`);
}

/** Undo an import: removes the batch's trades and executions. */
export async function deleteBatch(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await getCurrentUser();
  const batch = await db.importBatch.findFirst({ where: { id, userId: user.id } });
  if (batch) {
    await db.$transaction([
      db.trade.deleteMany({ where: { batchId: id, userId: user.id } }),
      db.importBatch.delete({ where: { id } }),
    ]);
  }
  revalidatePath("/trades");
  redirect("/trades/import?undone=1");
}
