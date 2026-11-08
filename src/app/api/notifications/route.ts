import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return NextResponse.json({
    notifications: rows,
    unread: rows.filter((n) => !n.read).length,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = z
      .object({
        action: z.enum(["mark_read", "mark_all_read"]),
        ids: z.array(z.string().uuid()).optional(),
      })
      .parse(await req.json());

    if (body.action === "mark_all_read") {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
      return NextResponse.json({ ok: true });
    }

    if (!body.ids || body.ids.length === 0) {
      return NextResponse.json({ error: "Notification IDs required." }, { status: 400 });
    }

    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, user.id),
          inArray(notifications.id, body.ids),
        )
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    console.error("[notifications]", err);
    return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  }
}
