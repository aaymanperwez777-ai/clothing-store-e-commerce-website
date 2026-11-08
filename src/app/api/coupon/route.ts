import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ code: z.string().min(2).max(40), subtotal: z.number().int().min(0) }).parse(await req.json());
    const code = body.code.trim().toUpperCase();
    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (!coupon || !coupon.active) return NextResponse.json({ error: "This coupon code is not valid." }, { status: 400 });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return NextResponse.json({ error: "This coupon has expired." }, { status: 400 });
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
      return NextResponse.json({ error: "This coupon has reached its usage limit." }, { status: 400 });
    if (body.subtotal < coupon.minOrder)
      return NextResponse.json(
        { error: `Minimum order of ₹${(coupon.minOrder / 100).toLocaleString("en-IN")} required.` },
        { status: 400 }
      );
    const discount =
      coupon.type === "percent"
        ? Math.min(Math.round((body.subtotal * coupon.value) / 100), body.subtotal)
        : Math.min(coupon.value, body.subtotal);
    return NextResponse.json({
      ok: true,
      code: coupon.code,
      discount,
      label: coupon.type === "percent" ? `${coupon.value}% off` : `₹${(coupon.value / 100).toLocaleString("en-IN")} off`,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
