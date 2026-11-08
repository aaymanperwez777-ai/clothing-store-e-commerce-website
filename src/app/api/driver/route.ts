import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  deliveryAssignments, deliveryEvents, orders, orderItems, drivers, notifications,
} from "@/db/schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";
import { requireDriver } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";
import { DRIVER_TRANSITIONS } from "@/lib/utils";

/** GET — driver's assigned deliveries */
export async function GET(req: NextRequest) {
  const user = await requireDriver();
  if (!user) return NextResponse.json({ error: "Driver access required." }, { status: 403 });
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "active";

  if (view === "active") {
    const rows = await db
      .select({
        id: deliveryAssignments.id,
        orderId: deliveryAssignments.orderId,
        orderNumber: orders.orderNumber,
        status: deliveryAssignments.status,
        shippingName: orders.shippingName,
        phone: orders.phone,
        address: orders.address,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        deliveryNotes: deliveryAssignments.deliveryNotes,
        assignedAt: deliveryAssignments.assignedAt,
        updatedAt: deliveryAssignments.updatedAt,
        itemCount: sql<number>`(select sum(qty) from order_items oi where oi.order_id = ${orders.id})`,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .where(and(
        eq(deliveryAssignments.driverId, user.driverId),
        sql`${deliveryAssignments.status} NOT IN ('delivered','cancelled','returned_to_store')`,
      ))
      .orderBy(asc(deliveryAssignments.assignedAt));
    return NextResponse.json({ deliveries: rows });
  }

  if (view === "completed") {
    const rows = await db
      .select({
        id: deliveryAssignments.id,
        orderNumber: orders.orderNumber,
        status: deliveryAssignments.status,
        shippingName: orders.shippingName,
        deliveredAt: deliveryAssignments.deliveredAt,
        otpVerified: deliveryAssignments.otpVerified,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .where(and(
        eq(deliveryAssignments.driverId, user.driverId),
        sql`${deliveryAssignments.status} IN ('delivered','cancelled','returned_to_store')`,
      ))
      .orderBy(desc(deliveryAssignments.deliveredAt))
      .limit(50);
    return NextResponse.json({ completed: rows });
  }

  if (view === "detail") {
    const assignmentId = url.searchParams.get("id");
    if (!assignmentId) return NextResponse.json({ error: "id required." }, { status: 400 });
    const [assignment] = await db
      .select({
        id: deliveryAssignments.id,
        orderId: deliveryAssignments.orderId,
        orderNumber: orders.orderNumber,
        status: deliveryAssignments.status,
        shippingName: orders.shippingName,
        phone: orders.phone,
        email: orders.email,
        address: orders.address,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        deliveryNotes: deliveryAssignments.deliveryNotes,
        assignedAt: deliveryAssignments.assignedAt,
        pickedUpAt: deliveryAssignments.pickedUpAt,
        deliveredAt: deliveryAssignments.deliveredAt,
        otpVerified: deliveryAssignments.otpVerified,
        notes: orders.notes,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .where(and(
        eq(deliveryAssignments.id, assignmentId),
        eq(deliveryAssignments.driverId, user.driverId),
      ))
      .limit(1);
    if (!assignment) return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
    const items = await db.select({
      name: orderItems.productName,
      size: orderItems.size,
      color: orderItems.color,
      qty: orderItems.qty,
    }).from(orderItems).where(eq(orderItems.orderId, assignment.orderId));
    const events = await db.select().from(deliveryEvents)
      .where(eq(deliveryEvents.assignmentId, assignmentId))
      .orderBy(desc(deliveryEvents.createdAt));
    return NextResponse.json({ delivery: assignment, items, events });
  }

  return NextResponse.json({ error: "Unknown view." }, { status: 400 });
}

/** POST — update delivery status */
export async function POST(req: NextRequest) {
  const user = await requireDriver();
  if (!user) return NextResponse.json({ error: "Driver access required." }, { status: 403 });
  try {
    const body = z.object({
      assignmentId: z.string().uuid(),
      status: z.string().min(2).max(30),
      note: z.string().max(500).optional().default(""),
      otp: z.string().max(10).optional(),
      lat: z.string().max(20).optional(),
      lng: z.string().max(20).optional(),
    }).parse(await req.json());

    // Fetch assignment — must belong to this driver
    const [assignment] = await db.select().from(deliveryAssignments).where(
      and(eq(deliveryAssignments.id, body.assignmentId), eq(deliveryAssignments.driverId, user.driverId))
    ).limit(1);
    if (!assignment) return NextResponse.json({ error: "Delivery not found or not assigned to you." }, { status: 404 });

    // Validate transition
    const allowed = DRIVER_TRANSITIONS[assignment.status];
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json({ error: `Cannot move from "${assignment.status}" to "${body.status}".` }, { status: 400 });
    }

    // OTP verification for delivery confirmation
    let otpVerified = false;
    if (body.status === "delivered") {
      if (
        !assignment.deliveryOtp ||
        !body.otp ||
        !/^\d{6}$/.test(body.otp) ||
        body.otp !== assignment.deliveryOtp
      ) {
        return NextResponse.json(
          { error: "A valid 6-digit customer OTP is required to confirm delivery." },
          { status: 400 }
        );
      }
      otpVerified = true;
    }

    const now = new Date();
    const updates: Partial<typeof deliveryAssignments.$inferInsert> = {
      status: body.status as typeof assignment.status,
      updatedAt: now,
      deliveryNotes: body.note || assignment.deliveryNotes,
    };
    if (body.status === "picked_up") updates.pickedUpAt = now;
    if (body.status === "delivered") {
      updates.deliveredAt = now;
      updates.confirmedAt = now;
      updates.otpVerified = otpVerified;
    }

    await db.update(deliveryAssignments).set(updates).where(eq(deliveryAssignments.id, body.assignmentId));

    // Record audit event
    await db.insert(deliveryEvents).values({
      assignmentId: body.assignmentId,
      orderId: assignment.orderId,
      driverId: user.driverId,
      status: body.status,
      note: body.note || null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
    });

    // Update order status to match
    const orderStatusMap: Record<string, string> = {
      picked_up: "shipped",
      out_for_delivery: "out_for_delivery",
      delivered: "delivered",
      returned_to_store: "returned",
    };
    const newOrderStatus = orderStatusMap[body.status];
    if (newOrderStatus) {
      const orderUpdate: Record<string, unknown> = { status: newOrderStatus, updatedAt: now };
      if (newOrderStatus === "delivered") {
        // COD: mark payment as collected
        const [order] = await db.select().from(orders).where(eq(orders.id, assignment.orderId)).limit(1);
        if (order?.paymentMethod === "cod") orderUpdate.paymentStatus = "paid";
      }
      await db.update(orders).set(orderUpdate).where(eq(orders.id, assignment.orderId));
    }

    // Notify customer
    const [order] = await db.select().from(orders).where(eq(orders.id, assignment.orderId)).limit(1);
    if (order?.userId) {
      const messages: Record<string, string> = {
        accepted: "Your delivery driver is preparing to pick up your order.",
        picked_up: "Your order has been picked up and is on its way.",
        out_for_delivery: "Your order is out for delivery! Keep your phone handy.",
        delivered: `Your order ${order.orderNumber} has been delivered. ${otpVerified ? "Verified with OTP." : ""}`,
        attempted: "A delivery attempt was made but could not be completed.",
        customer_unavailable: "The delivery driver was unable to reach you. We'll try again.",
        rescheduled: "Your delivery has been rescheduled.",
        returned_to_store: "Your order has been returned to the store.",
      };
      const msg = messages[body.status];
      if (msg) {
        await sendNotification({
          userId: order.userId,
          type: "delivery",
          title: `Delivery update: ${order.orderNumber}`,
          body: msg,
        });
      }
    }

    return NextResponse.json({ ok: true, status: body.status, otpVerified });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error("[driver:update]", err);
    return NextResponse.json({ error: "Status update failed." }, { status: 500 });
  }
}
