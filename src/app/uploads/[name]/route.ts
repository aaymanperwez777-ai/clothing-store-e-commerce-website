import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const;

/**
 * Serves admin-uploaded product images from disk.
 * Strict allowlist pattern — no path traversal is possible.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const match = /^([a-f0-9-]{36})\.(png|jpg|webp|gif)$/.exec(name);
  if (!match) return new NextResponse("Not found", { status: 404 });

  try {
    const buf = await readFile(path.join(UPLOAD_DIR, `${match[1]}.${match[2]}`));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[match[2] as keyof typeof MIME],
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
