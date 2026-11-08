import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendNotification } from "@/lib/notifications";

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return NextResponse.json({ error: "Payments not configured." }, { status: 503 });

    const body = z
      .object({
        orderNumber: z.string().min(6),
        razorpay_order_id: z.string().min(6),
        razorpay_payment_id: z.string().min(6),
        razorpay_signature: z.string().min(10),
      })
      .parse(await req.json());

    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, body.orderNumber)).limit(1);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Idempotent: already confirmed
    if (order.paymentStatus === "paid") return NextResponse.json({ ok: true, orderNumber: order.orderNumber });

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeEqual(expected, body.razorpay_signature)) {
      await db.update(payments).set({ status: "failed" }).where(and(eq(payments.orderId, order.id), eq(payments.providerOrderId, body.razorpay_order_id)));
      await db.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, order.id));
      return NextResponse.json({ error: "Payment verification failed. Signature mismatch." }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: "paid",
          providerPaymentId: body.razorpay_payment_id,
          signature: body.razorpay_signature,
        })
        .where(and(eq(payments.orderId, order.id), eq(payments.providerOrderId, body.razorpay_order_id)));
      await tx
        .update(orders)
        .set({ paymentStatus: "paid", status: "confirmed", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      if (order.userId) {
        await sendNotification({
          userId: order.userId,
          type: "payment",
          title: `Payment received for ${order.orderNumber}`,
          body: "Your payment was verified. Your order is confirmed.",
        });
      }
    });

    return NextResponse.json({ ok: true, orderNumber: order.orderNumber });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    console.error("[razorpay:verify]", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
