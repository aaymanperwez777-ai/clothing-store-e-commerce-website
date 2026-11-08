import "server-only";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

export type NotificationType = "order" | "payment" | "delivery" | "system";

export async function sendNotification({
  userId,
  type,
  title,
  body,
  external = true,
  recipientEmail = null,
}: {
  userId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  external?: boolean;
  recipientEmail?: string | null;
}) {
  // 1. Internal notification (DB)
  if (userId) {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
    });
  }

  // 2. External notification (Email)
  if (external) {
    let emailTo = recipientEmail;
    if (!emailTo && userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        emailTo = user.email;
      }
    }

    if (emailTo) {
      if (process.env.SMTP_URL) {
        try {
          const transporter = nodemailer.createTransport(process.env.SMTP_URL);
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"CLOTHING STORE" <noreply@example.com>',
            to: emailTo,
            subject: title,
            text: body,
          });
        } catch (err) {
          console.error("[NOTIFY] Email dispatch failed.");
        }
      } else {
        console.log("[NOTIFY] Email skipped: SMTP_URL not configured.");
      }
    }
  }
}
