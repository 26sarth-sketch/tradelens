import type { NextRequest } from "next/server";
import { CONTENT_TYPES, readImage } from "@/lib/uploads";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/uploads/[file]">) {
  const { file } = await ctx.params;
  const data = await readImage(file);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[file.split(".").pop()!],
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
