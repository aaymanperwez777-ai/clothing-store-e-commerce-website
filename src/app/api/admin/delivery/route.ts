import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  drivers, users, deliveryAssignments, deliveryEvents, orders, orderItems, notifications,
} from "@/db/schema";
import { eq, desc, asc, sql, and, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import crypto from "node:crypto";

async function guard() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("FORBIDDEN");
  return admin;
}

/** GET — list drivers, pending orders, active assignments */
export async function GET(req: NextRequest) {
  try { await guard(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "overview";

  if (view === "drivers") {
    const rows = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        phone: drivers.phone,
        vehicle: drivers.vehicle,
        active: drivers.active,
        userId: drivers.userId,
        email: users.email,
        activeDeliveries: sql<number>`(select count(*) from delivery_assignments da where da.driver_id = ${drivers.id} and da.status not in ('delivered','cancelled','returned_to_store'))`,
        totalDeliveries: sql<number>`(select count(*) from delivery_assignments da where da.driver_id = ${drivers.id})`,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .orderBy(desc(drivers.active), asc(drivers.name));
    return NextResponse.json({ drivers: rows });
  }

  if (view === "pending") {
    // Orders that are packed or confirmed but have no delivery assignment
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        shippingName: orders.shippingName,
        phone: orders.phone,
        address: orders.address,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        createdAt: orders.createdAt,
        itemCount: sql<number>`(select sum(qty) from order_items oi where oi.order_id = ${orders.id})`,
      })
      .from(orders)
      .where(
        and(
          sql`${orders.status} IN ('confirmed','processing','packed')`,
          sql`NOT EXISTS (select 1 from delivery_assignments da where da.order_id = ${orders.id} and da.status not in ('cancelled','returned_to_store'))`,
        )
      )
      .orderBy(asc(orders.createdAt));
    return NextResponse.json({ orders: rows });
  }

    if (view === "active") {
    const rows = await db
      .select({
        id: deliveryAssignments.id,
        orderId: deliveryAssignments.orderId,
        orderNumber: orders.orderNumber,
        driverId: deliveryAssignments.driverId,
        driverName: drivers.name,
        status: deliveryAssignments.status,
        shippingName: orders.shippingName,
        phone: orders.phone,
        address: orders.address,
        total: orders.total,
        deliveryNotes: deliveryAssignments.deliveryNotes,
        assignedAt: deliveryAssignments.assignedAt,
        updatedAt: deliveryAssignments.updatedAt,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .innerJoin(drivers, eq(deliveryAssignments.driverId, drivers.id))
      .where(sql`${deliveryAssignments.status} NOT IN ('delivered','cancelled','returned_to_store')`)
      .orderBy(asc(deliveryAssignments.assignedAt));
    // De-duplicate: only the latest active assignment per order
    const seen = new Set<string>();
    const unique = rows.filter(r => { if (seen.has(r.orderId)) return false; seen.add(r.orderId); return true; });
    return NextResponse.json({ assignments: unique });
  }

  if (view === "history") {
    const rows = await db
      .select({
        id: deliveryAssignments.id,
        orderNumber: orders.orderNumber,
        driverName: drivers.name,
        status: deliveryAssignments.status,
        shippingName: orders.shippingName,
        assignedAt: deliveryAssignments.assignedAt,
        deliveredAt: deliveryAssignments.deliveredAt,
        deliveryNotes: deliveryAssignments.deliveryNotes,
        otpVerified: deliveryAssignments.otpVerified,
      })
      .from(deliveryAssignments)
      .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
      .innerJoin(drivers, eq(deliveryAssignments.driverId, drivers.id))
      .where(sql`${deliveryAssignments.status} IN ('delivered','cancelled','returned_to_store')`)
      .orderBy(desc(deliveryAssignments.deliveredAt))
      .limit(100);
    return NextResponse.json({ history: rows });
  }

  if (view === "events") {
    const assignmentId = url.searchParams.get("assignmentId");
    if (!assignmentId) return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    const rows = await db
      .select()
      .from(deliveryEvents)
      .where(eq(deliveryEvents.assignmentId, assignmentId))
      .orderBy(desc(deliveryEvents.createdAt));
    return NextResponse.json({ events: rows });
  }

  return NextResponse.json({ error: "Unknown view" }, { status: 400 });
}

/** POST — create driver, assign order, reassign */
export async function POST(req: NextRequest) {
  try { await guard(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "create_driver") {
      const input = z.object({
        name: z.string().min(2).max(80),
        email: z.string().email().max(120),
        phone: z.string().min(10).max(15),
        vehicle: z.string().max(80).default(""),
        password: z.string().min(8).max(100),
      }).parse(body);
      const email = input.email.toLowerCase().trim();
      // Create user account first
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing[0]) return NextResponse.json({ error: "Email already registered." }, { status: 409 });
      const [user] = await db.insert(users).values({
        name: input.name,
        email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        role: "customer", // role stays customer in user table; driver table grants driver powers
      }).returning();
      const [driver] = await db.insert(drivers).values({
        userId: user.id,
        name: input.name,
        phone: input.phone,
        vehicle: input.vehicle,
        active: true,
      }).returning();
      return NextResponse.json({ ok: true, driver });
    }

    if (action === "assign") {
      const input = z.object({
        orderId: z.string().uuid(),
        driverId: z.string().uuid(),
      }).parse(body);
      // Check no active assignment exists
      const existing = await db.select().from(deliveryAssignments).where(
        and(eq(deliveryAssignments.orderId, input.orderId), sql`${deliveryAssignments.status} NOT IN ('cancelled','returned_to_store')`)
      ).limit(1);
      if (existing[0]) return NextResponse.json({ error: "Order already has an active delivery assignment." }, { status: 409 });
      // Generate OTP for delivery confirmation
      const otp = String(crypto.randomInt(100000, 999999));
      const [assignment] = await db.insert(deliveryAssignments).values({
        orderId: input.orderId,
        driverId: input.driverId,
        status: "assigned",
        deliveryOtp: otp,
      }).returning();
      // Update order status
      await db.update(orders).set({ status: "shipped", updatedAt: new Date() }).where(eq(orders.id, input.orderId));
      // Audit event
      await db.insert(deliveryEvents).values({
        assignmentId: assignment.id,
        orderId: input.orderId,
        driverId: input.driverId,
        status: "assigned",
        note: "Driver assigned by admin",
      });
      // Notify customer
      const order = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (order[0]?.userId) {
        await db.insert(notifications).values({
          userId: order[0].userId,
          type: "delivery",
          title: `Driver assigned for ${order[0].orderNumber}`,
          body: `Your order is being prepared for delivery. OTP for confirmation: ${otp}`,
        });
      }
      return NextResponse.json({ ok: true, assignment, otp });
    }

    if (action === "reassign") {
      const input = z.object({
        assignmentId: z.string().uuid(),
        newDriverId: z.string().uuid(),
      }).parse(body);
      const [old] = await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.id, input.assignmentId)).limit(1);
      if (!old) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      // Cancel old assignment
      await db.update(deliveryAssignments).set({ status: "cancelled", updatedAt: new Date() }).where(eq(deliveryAssignments.id, old.id));
      await db.insert(deliveryEvents).values({
        assignmentId: old.id, orderId: old.orderId, driverId: old.driverId,
        status: "cancelled", note: "Reassigned by admin",
      });
      // Create new
      const otp = String(crypto.randomInt(100000, 999999));
      const [newAssignment] = await db.insert(deliveryAssignments).values({
        orderId: old.orderId,
        driverId: input.newDriverId,
        status: "assigned",
        deliveryOtp: otp,
      }).returning();
      await db.insert(deliveryEvents).values({
        assignmentId: newAssignment.id, orderId: old.orderId, driverId: input.newDriverId,
        status: "assigned", note: "Reassigned by admin",
      });
      return NextResponse.json({ ok: true, assignment: newAssignment });
    }

    if (action === "toggle_driver") {
      const input = z.object({ driverId: z.string().uuid(), active: z.boolean() }).parse(body);
      await db.update(drivers).set({ active: input.active }).where(eq(drivers.id, input.driverId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error("[admin:delivery]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
