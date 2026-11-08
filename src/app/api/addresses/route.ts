import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { isValidPhone, isValidPincode } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = z
      .object({
        fullName: z.string().min(2).max(100),
        phone: z.string().min(10).max(15),
        line1: z.string().min(3).max(160),
        line2: z.string().max(160).optional().default(""),
        city: z.string().min(2).max(80),
        state: z.string().min(2).max(80),
        pincode: z.string().length(6),
      })
      .parse(await req.json());
    if (!isValidPhone(body.phone)) return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    if (!isValidPincode(body.pincode)) return NextResponse.json({ error: "Invalid PIN code." }, { status: 400 });
    const [a] = await db.insert(addresses).values({ ...body, userId: user.id }).returning();
    return NextResponse.json({ ok: true, address: a });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    return NextResponse.json({ error: "Failed to save address." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = z.object({ id: z.string().uuid() }).parse(await req.json());
    await db.delete(addresses).where(and(eq(addresses.id, body.id), eq(addresses.userId, user.id)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
