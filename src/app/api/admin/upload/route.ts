import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { requireAdmin } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
// stored outside /public (build-time manifest) and streamed by /uploads/[name] at runtime
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// Cloudinary configuration
const isProd = process.env.NODE_ENV === "production";
const useCloudinary = !!process.env.CLOUDINARY_URL && !!process.env.VERCEL;

if (useCloudinary) {
  cloudinary.config({
    secure: true,
  });
}

type ImageKind = { ext: string; mime: string };

/** Sniff real file type from magic bytes â€” never trust the client MIME header. */
function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50)
    return { ext: "webp", mime: "image/webp" };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return { ext: "gif", mime: "image/gif" };
  return null;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach an image file." }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: "Empty file." }, { status: 400 });
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: "Image too large â€” maximum 5 MB." }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(buf);
    if (!kind) {
      return NextResponse.json({ error: "Unsupported file. Upload a real JPG, PNG, WebP or GIF image." }, { status: 400 });
    }

    if (isProd && process.env.VERCEL && !useCloudinary) {
      return NextResponse.json({ error: "Production environment requires CLOUDINARY_URL for persistent image storage." }, { status: 500 });
    }

    if (useCloudinary) {
      const b64 = buf.toString("base64");
      const dataURI = `data:${kind.mime};base64,${b64}`;
      const uploadRes = await cloudinary.uploader.upload(dataURI, {
        folder: "funkyculture",
        resource_type: "image",
      });
      return NextResponse.json({ ok: true, path: uploadRes.secure_url, bytes: file.size, mime: kind.mime });
    } else {
      const name = `${crypto.randomUUID()}.${kind.ext}`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, name), buf);
      return NextResponse.json({ ok: true, path: `/uploads/${name}`, bytes: file.size, mime: kind.mime });
    }
  } catch (err) {
    console.error("[admin:upload]", err);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "Upload failed. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { path: p } = (await req.json()) as { path?: string };
    if (!p) return NextResponse.json({ error: "Invalid file path." }, { status: 400 });

    if (p.includes("res.cloudinary.com")) {
      if (!useCloudinary) return NextResponse.json({ error: "Cloudinary not configured." }, { status: 500 });
      // Extract public_id from Cloudinary URL (e.g., https://res.cloudinary.com/.../funkyculture/abcd.png)
      const parts = p.split("/");
      const filename = parts[parts.length - 1];
      const publicId = "funkyculture/" + filename.split(".")[0];
      await cloudinary.uploader.destroy(publicId);
      return NextResponse.json({ ok: true });
    }

    // strict allowlist for local files: only files this endpoint created
    if (!/^\/uploads\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(p)) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }
    await unlink(path.join(UPLOAD_DIR, path.basename(p))).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}




