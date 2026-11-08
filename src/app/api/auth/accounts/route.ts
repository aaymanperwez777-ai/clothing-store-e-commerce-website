import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users, drivers } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { ACCOUNT_COOKIE_PREFIX, SESSION_COOKIE } from "@/lib/auth";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  };
}

export async function GET() {
  try {
    const jar = await cookies();
    const now = new Date();
    const activeToken = jar.get(SESSION_COOKIE)?.value;

    // Migrate an existing active login into a remembered account cookie.
    if (activeToken) {
      const [active] = await db
        .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(and(eq(sessions.token, activeToken), gt(sessions.expiresAt, now)))
        .limit(1);

      if (active) {
        jar.set(`${ACCOUNT_COOKIE_PREFIX}${active.userId}`, activeToken, cookieOptions(active.expiresAt));
      }
    }

    const saved = jar.getAll().filter((cookie) => cookie.name.startsWith(ACCOUNT_COOKIE_PREFIX));
    const accounts: {
      id: string;
      name: string;
      email: string;
      role: string;
      driverId: string | null;
    }[] = [];
    const seen = new Set<string>();

    for (const cookie of saved) {
      const userId = cookie.name.slice(ACCOUNT_COOKIE_PREFIX.length);
      if (!UUID_PATTERN.test(userId) || seen.has(userId)) {
        jar.delete(cookie.name);
        continue;
      }

      const [record] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(
          eq(sessions.userId, userId),
          eq(sessions.token, cookie.value),
          gt(sessions.expiresAt, now)
        ))
        .limit(1);

      if (!record) {
        jar.delete(cookie.name);
        continue;
      }

      const [driver] = await db
        .select({ id: drivers.id })
        .from(drivers)
        .where(and(eq(drivers.userId, userId), eq(drivers.active, true)))
        .limit(1);

      accounts.push({
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role,
        driverId: driver?.id ?? null,
      });
      seen.add(userId);
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("[auth:accounts:get]", error);
    return NextResponse.json({ error: "Could not load saved accounts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");

    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }

    const body = await req.json();
    const action = body?.action;
    const userId = body?.userId;

    if (!UUID_PATTERN.test(userId ?? "")) {
      return NextResponse.json({ error: "Invalid account." }, { status: 400 });
    }

    if (action !== "switch" && action !== "remove") {
      return NextResponse.json({ error: "Invalid account action." }, { status: 400 });
    }

    const jar = await cookies();
    const savedCookieName = `${ACCOUNT_COOKIE_PREFIX}${userId}`;
    const savedToken = jar.get(savedCookieName)?.value;

    if (!savedToken) {
      return NextResponse.json({ error: "This account is no longer saved. Please sign in again." }, { status: 401 });
    }

    const [validSession] = await db
      .select({ token: sessions.token, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        eq(sessions.token, savedToken),
        gt(sessions.expiresAt, new Date())
      ))
      .limit(1);

    if (!validSession) {
      jar.delete(savedCookieName);
      return NextResponse.json({ error: "Saved session expired. Please sign in again." }, { status: 401 });
    }

    if (action === "switch") {
      jar.set(SESSION_COOKIE, savedToken, cookieOptions(validSession.expiresAt));
      return NextResponse.json({ ok: true });
    }

    await db.delete(sessions).where(
      and(eq(sessions.userId, userId), eq(sessions.token, savedToken))
    );
    jar.delete(savedCookieName);

    if (jar.get(SESSION_COOKIE)?.value === savedToken) {
      jar.delete(SESSION_COOKIE);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth:accounts:post]", error);
    return NextResponse.json({ error: "Could not update saved accounts." }, { status: 500 });
  }
}