// Where screenshot bytes live. Validation happens in lib/uploads.ts; this module only stores.
// - Local dev: files in uploads/ (git-ignored).
// - Hosted (Vercel): BLOB_READ_WRITE_TOKEN set → a *private* Vercel Blob store, under screenshots/.
// Either way the app serves them through app/api/uploads/[file]/route.ts, so the stored
// value on a trade is just the generated file name.

import { del, get, list, put } from "@vercel/blob";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Resolved at runtime. Turbopack statically traces filesystem calls; without the
// `turbopackIgnore` hints below (and with `path.join(process.cwd(), …)`), it traces the
// whole project, which in dev caused an endless Fast Refresh reload loop.
export const UPLOAD_DIR = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "uploads");
const BLOB_PREFIX = "screenshots/";

export const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
/** On Vercel without a Blob store the disk is read-only, so uploads are switched off. */
export const uploadsEnabled = () => usingBlob() || !process.env.VERCEL;

const localPath = (name: string) => path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name);

export async function putFile(name: string, data: Buffer, contentType: string) {
  if (usingBlob()) {
    await put(BLOB_PREFIX + name, data, { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  if (!uploadsEnabled()) throw new Error("uploads disabled");
  await mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });
  await writeFile(/* turbopackIgnore: true */ localPath(name), data);
}

export async function getFile(name: string): Promise<Buffer | null> {
  try {
    if (usingBlob()) {
      const r = await get(BLOB_PREFIX + name, { access: "private" });
      if (!r || r.statusCode !== 200) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
    return await readFile(/* turbopackIgnore: true */ localPath(name));
  } catch {
    return null;
  }
}

export async function deleteFile(name: string) {
  if (usingBlob()) {
    await del(BLOB_PREFIX + name).catch(() => {});
    return;
  }
  await unlink(/* turbopackIgnore: true */ localPath(name)).catch(() => {});
}

/** Removes every stored screenshot (used when the demo data is reset). */
export async function clearFiles() {
  if (usingBlob()) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: BLOB_PREFIX, cursor });
      if (page.blobs.length) await del(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return;
  }
  for (const f of await readdir(/* turbopackIgnore: true */ UPLOAD_DIR).catch(() => [] as string[])) {
    if (f !== ".gitkeep") await unlink(/* turbopackIgnore: true */ localPath(f)).catch(() => {});
  }
}
