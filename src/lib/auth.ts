import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { sessions, users, drivers } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const SESSION_COOKIE = "fc_session";
export const ACCOUNT_COOKIE_PREFIX = "fc_account_";

export function accountCookieName(userId: string): string {
  return `${ACCOUNT_COOKIE_PREFIX}${userId}`;
}
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "customer" | "admin";
  driverId?: string | null;
};

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });

  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  };

  jar.set(SESSION_COOKIE, token, options);
  jar.set(accountCookieName(userId), token, options);
  return token;
}

export async function destroySession(): Promise<void> {
  // Sign out of the active account while retaining its separately
  // protected remembered session for the account switcher.
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0] ?? null;
  if (!user) return null;
  // Check if user is also a driver
  const driverRows = await db.select({ id: drivers.id }).from(drivers).where(and(eq(drivers.userId, user.id), eq(drivers.active, true))).limit(1);
  return { ...user, driverId: driverRows[0]?.id ?? null };
}

export async function requireDriver(): Promise<(SessionUser & { driverId: string }) | null> {
  const user = await getSessionUser();
  if (!user || !user.driverId) return null;
  return user as SessionUser & { driverId: string };
}

export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
