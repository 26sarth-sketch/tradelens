"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { isDayKey } from "@/lib/format";

/** Saves the free-form note for one IST trading day. */
export async function saveDayNotes(date: string, notes: string): Promise<{ ok: boolean; error?: string }> {
  if (!isDayKey(date)) return { ok: false, error: "Invalid date" };
  if (notes.length > 10_000) return { ok: false, error: "Note is too long (10,000 characters max)." };
  const user = await getCurrentUser();
  await db.dailyJournal.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, notes },
    update: { notes },
  });
  revalidatePath("/journal");
  revalidatePath(`/journal/${date}`);
  return { ok: true };
}
