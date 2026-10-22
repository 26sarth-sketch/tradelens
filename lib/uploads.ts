import "server-only";
// Screenshot uploads: validation and naming. Bytes are stored by lib/storage.ts (local disk
// in dev, private Vercel Blob when deployed) and served by app/api/uploads/[file]/route.ts.

import { randomUUID } from "node:crypto";
import { deleteFile, getFile, putFile } from "./storage";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Only names we generate are ever read back: uuid + known image extension. */
export const SAFE_NAME = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

export const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Detects the image type from its first bytes (never trusts the file name or MIME). */
function sniff(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.toString("ascii", 0, 4) === "GIF8") return "gif";
  return null;
}

export async function saveImage(file: File): Promise<{ name: string } | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "Screenshot must be 5 MB or smaller." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { error: "Screenshot must be a PNG, JPG, WebP or GIF image." };
  const name = `${randomUUID()}.${ext}`;
  await putFile(name, buf, CONTENT_TYPES[ext]);
  return { name };
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!SAFE_NAME.test(name)) return null;
  return getFile(name);
}

export async function deleteImage(name: string | null | undefined) {
  if (!name || !SAFE_NAME.test(name)) return;
  await deleteFile(name);
}
