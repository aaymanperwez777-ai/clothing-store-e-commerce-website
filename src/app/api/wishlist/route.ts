import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { wishlists } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ids: [] });
  const rows = await db.select().from(wishlists).where(eq(wishlists.userId, user.id));
  return NextResponse.json({ ids: rows.map((r) => r.productId) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to save items to your wishlist." }, { status: 401 });
  try {
    const body = z.object({ productId: z.string().uuid() }).parse(await req.json());
    const [existing] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userId, user.id), eq(wishlists.productId, body.productId)))
      .limit(1);
    if (existing) {
      await db.delete(wishlists).where(eq(wishlists.id, existing.id));
      return NextResponse.json({ ok: true, wished: false });
    }
    await db.insert(wishlists).values({ userId: user.id, productId: body.productId });
    return NextResponse.json({ ok: true, wished: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
