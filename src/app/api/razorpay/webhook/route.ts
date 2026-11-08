import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Razorpay webhook — verifies X-Razorpay-Signature with the webhook secret.
 * Handles payment.captured / payment.failed for out-of-band confirmation.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string; status: string } } };
    };
    const payment = event.payload?.payment?.entity;
    if (!payment) return NextResponse.json({ ok: true });

    if (event.event === "payment.captured") {
      await db.transaction(async (tx) => {
        // Atomic conditional update for idempotency
        const updatedPayment = await tx
          .update(payments)
          .set({ 
            status: "paid", 
            providerPaymentId: payment.id, 
            raw: event as unknown as object 
          })
          .where(and(
            eq(payments.providerOrderId, payment.order_id),
            eq(payments.status, "pending")
          ))
          .returning();

        if (updatedPayment.length === 0) {
          // Already processed or not found
          return;
        }

        await tx
          .update(orders)
          .set({ 
            paymentStatus: "paid", 
            status: "confirmed", 
            updatedAt: new Date() 
          })
          .where(and(
            eq(orders.id, updatedPayment[0].orderId), 
            eq(orders.paymentStatus, "pending")
          ));
      });
    } else if (event.event === "payment.failed") {
      await db.transaction(async (tx) => {
        const updatedPayment = await tx
          .update(payments)
          .set({ 
            status: "failed", 
            raw: event as unknown as object 
          })
          .where(and(
            eq(payments.providerOrderId, payment.order_id),
            eq(payments.status, "pending")
          ))
          .returning();

        if (updatedPayment.length > 0) {
          await tx
            .update(orders)
            .set({ 
              paymentStatus: "failed", 
              updatedAt: new Date() 
            })
            .where(and(
              eq(orders.id, updatedPayment[0].orderId), 
              eq(orders.paymentStatus, "pending")
            ));
        }
      });
    } else if (event.event === "refund.processed") {
      const paymentRecord = await db
        .select()
        .from(payments)
        .where(eq(payments.providerOrderId, payment.order_id))
        .limit(1);

      if (paymentRecord.length > 0) {
        await db
          .update(orders)
          .set({ paymentStatus: "refunded", status: "refunded", updatedAt: new Date() })
          .where(and(
            eq(orders.id, paymentRecord[0].orderId),
            sql`${orders.paymentStatus} != 'refunded'`
          ));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[razorpay:webhook]", err);
    // The webhook must not acknowledge successful processing when a critical database operation failed.
    return NextResponse.json({ error: "Failed to process webhook." }, { status: 500 });
  }
}
