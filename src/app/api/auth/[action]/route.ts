import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { users, passwordResets } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { hashPassword, verifyPassword, createSession, destroySession, getSessionUser } from "@/lib/auth";
import { isValidEmail, rateLimit } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(100),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  // rate limit all auth endpoints
  if (!rateLimit(`auth:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  try {
    if (action === "register") {
      const body = registerSchema.parse(await req.json());
      const email = body.email.toLowerCase().trim();
      if (!isValidEmail(email)) return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing[0]) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      const passwordHash = await hashPassword(body.password);
      const [user] = await db
        .insert(users)
        .values({ name: body.name.trim(), email, phone: body.phone ?? null, passwordHash, role: "customer" })
        .returning();
      await createSession(user.id);
      return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    if (action === "login") {
      const body = loginSchema.parse(await req.json());
      const email = body.email.toLowerCase().trim();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      await createSession(user.id);
      return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    if (action === "logout") {
      await destroySession();
      return NextResponse.json({ ok: true });
    }

    if (action === "me") {
      const user = await getSessionUser();
      return NextResponse.json({ user });
    }

    if (action === "forgot") {
      const body = z.object({ email: z.string().email() }).parse(await req.json());
      const email = body.email.toLowerCase().trim();

      // Require SMTP in all environments for this flow
      if (!process.env.SMTP_URL) {
        return NextResponse.json(
          { error: "Password reset is currently unavailable. Please contact support." },
          { status: 503 }
        );
      }

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const [resetRecord] = await db.insert(passwordResets).values({
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }).returning();
        
        const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/account?reset=${token}`;
        const emailTitle = "Password Reset - CLOTHING STORE";
        const emailBody = `You requested a password reset. Click the link below to reset your password:\n\n${url}\n\nIf you did not request this, please ignore this email.`;
        
        try {
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.createTransport(process.env.SMTP_URL);
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"CLOTHING STORE" <noreply@example.com>',
            to: email,
            subject: emailTitle,
            text: emailBody,
          });
        } catch (err) {
          // If SMTP fails, safely invalidate the newly generated reset token
          await db.delete(passwordResets).where(eq(passwordResets.id, resetRecord.id));
          console.error("[AUTH] Email dispatch failed.");
        }
      }
      // Always respond ok to avoid account enumeration
      return NextResponse.json({ ok: true, message: "If an account exists, a reset link has been sent." });
    }

    if (action === "reset") {
      const body = z.object({ token: z.string().min(10), password: z.string().min(8).max(100) }).parse(await req.json());
      
      try {
        await db.transaction(async (tx) => {
          // Implementing an atomic conditional update: claim the token if it's valid and unused
          const updated = await tx
            .update(passwordResets)
            .set({ usedAt: new Date() })
            .where(
              and(
                eq(passwordResets.token, body.token),
                isNull(passwordResets.usedAt),
                gt(passwordResets.expiresAt, new Date())
              )
            )
            .returning();

          if (updated.length === 0) {
            throw new Error("INVALID_TOKEN");
          }

          const row = updated[0];
          await tx.update(users).set({ passwordHash: await hashPassword(body.password) }).where(eq(users.id, row.userId));
        });
      } catch (err) {
        if (err instanceof Error && err.message === "INVALID_TOKEN") {
           return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
        }
        throw err;
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown auth action." }, { status: 404 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    console.error(`[auth:${action}]`, err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
