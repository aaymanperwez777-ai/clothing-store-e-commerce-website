import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ email: z.string().email().max(120) }).parse(await req.json());
    await db
      .insert(newsletterSubscribers)
      .values({ email: body.email.toLowerCase().trim() })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true, message: "You're on the list. Welcome to CLOTHING STORE." });
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
}
