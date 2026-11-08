import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to write a review." }, { status: 401 });
  try {
    const body = z
      .object({ productId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().min(3).max(600) })
      .parse(await req.json());
    await db.insert(reviews).values({ userId: user.id, productId: body.productId, rating: body.rating, comment: body.comment });
    return NextResponse.json({ ok: true, message: "Thanks! Your review will appear after moderation." });
  } catch {
    return NextResponse.json({ error: "Invalid review." }, { status: 400 });
  }
}
