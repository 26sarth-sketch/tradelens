import "server-only";
// Screenshot storage on local disk (uploads/, git-ignored), served by
// app/api/uploads/[file]/route.ts. Swap for S3/R2 in production.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Resolved at runtime. Avoid `path.join(process.cwd(), …)` here: Turbopack traces that
// pattern, starts watching the project folder, and the dev server's own writes then
// trigger an endless Fast Refresh reload loop on any page that imports this module.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
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
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return { name };
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!SAFE_NAME.test(name)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

export async function deleteImage(name: string | null | undefined) {
  if (!name || !SAFE_NAME.test(name)) return;
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}
