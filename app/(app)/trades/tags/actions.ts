"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runAutoTagger } from "@/lib/autotag-store";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

function refresh(tradeId?: string) {
  revalidatePath("/trades/tags");
  revalidatePath("/trades");
  if (tradeId) revalidatePath(`/trades/${tradeId}`);
}

export async function scanForTags(): Promise<void> {
  const user = await getCurrentUser();
  const found = await runAutoTagger(user.id);
  refresh();
  // Navigate (not just revalidate) so the list always re-renders with the new suggestions.
  redirect(`/trades/tags?found=${found}`);
}

/** Accept or dismiss one suggestion. FormData: tradeId, tagId, decision ("accept" | "dismiss"). */
export async function decideSuggestion(formData: FormData) {
  const user = await getCurrentUser();
  const tradeId = String(formData.get("tradeId"));
  const tagId = String(formData.get("tagId"));
  const accept = formData.get("decision") === "accept";
  await db.tradeTag.updateMany({
    where: { tradeId, tagId, accepted: false, trade: { userId: user.id } },
    data: accept ? { accepted: true, dismissed: false } : { dismissed: true },
  });
  refresh(tradeId);
}

/** Accept or dismiss every pending suggestion, optionally for one tag. */
export async function decideAll(formData: FormData) {
  const user = await getCurrentUser();
  const tagId = formData.get("tagId") ? String(formData.get("tagId")) : undefined;
  const accept = formData.get("decision") === "accept";
  await db.tradeTag.updateMany({
    where: { accepted: false, dismissed: false, trade: { userId: user.id }, ...(tagId ? { tagId } : {}) },
    data: accept ? { accepted: true } : { dismissed: true },
  });
  refresh();
}
