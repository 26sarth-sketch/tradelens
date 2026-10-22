"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BrokeragePlanKey } from "@/config/market";
import { db } from "@/lib/db";
import { type ColumnMap, parseGenericCsv } from "@/lib/import/generic";
import { commitImport, type ImportPreview, previewImport } from "@/lib/import/service";
import type { ParseResult } from "@/lib/import/types";
import { NotZerodhaError, parseZerodhaTradebook } from "@/lib/import/zerodha";
import type { ImportSource } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";

const MAX_BYTES = 10 * 1024 * 1024;

export type PreviewState = { error?: string; preview?: ImportPreview; filename?: string };

type Parsed = { parsed: ParseResult; source: ImportSource; filename: string; columnMap?: ColumnMap };

/**
 * Reads the uploaded file and parses it with the chosen importer.
 * FormData: file, kind ("zerodha" | "generic"); for generic also map (JSON), broker, qtyInLots.
 */
async function parseUpload(formData: FormData): Promise<Parsed | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 10 MB. Split it by date range." };
  const text = await file.text();

  try {
    if (formData.get("kind") === "generic") {
      const columnMap = JSON.parse(String(formData.get("map") ?? "{}")) as ColumnMap;
      const parsed = parseGenericCsv(text, columnMap, {
        broker: String(formData.get("broker") ?? "GENERIC"),
        qtyInLots: formData.get("qtyInLots") === "true",
      });
      return { parsed, source: "GENERIC", filename: file.name, columnMap };
    }
    return { parsed: parseZerodhaTradebook(text), source: "ZERODHA", filename: file.name };
  } catch (e) {
    if (e instanceof NotZerodhaError || (e instanceof Error && e.message.startsWith("Map these columns"))) {
      return { error: e.message };
    }
    throw e;
  }
}

export async function previewUpload(formData: FormData): Promise<PreviewState> {
  const r = await parseUpload(formData);
  if ("error" in r) return r;
  const user = await getCurrentUser();
  const preview = await previewImport(r.parsed, user.profile?.brokeragePlan as BrokeragePlanKey | undefined);
  return { preview, filename: r.filename };
}

export async function commitUpload(formData: FormData): Promise<{ error?: string }> {
  const r = await parseUpload(formData);
  if ("error" in r) return r;
  const user = await getCurrentUser();
  const batch = await commitImport({
    userId: user.id,
    source: r.source,
    filename: r.filename,
    columnMap: r.columnMap as Record<string, string> | undefined,
    parsed: r.parsed,
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
