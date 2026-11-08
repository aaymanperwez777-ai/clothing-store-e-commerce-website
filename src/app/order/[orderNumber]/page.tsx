import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { orders, deliveryAssignments, deliveryEvents, drivers } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { formatINR, ORDER_STEPS, ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS } from "@/lib/utils";
import { DeliveryTrackingLive } from "@/components/delivery-tracking-live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order Status", robots: { index: false } };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const placed = sp.placed === "1";

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true, payments: true },
  });
  if (!order) notFound();

  // Permission check
  const user = await getSessionUser();

  if (order.userId) {
    if (!user || (user.id !== order.userId && user.role !== "admin")) {
      if (!user) redirect(`/account?next=/order/${orderNumber}`);
      else return <div className="p-20 text-center">Unauthorized.</div>;
    }
  } else if (user?.role !== "admin") {
    // guest-order access verification
    const secret = process.env.GUEST_ORDER_SECRET;
    if (!secret || secret.length < 32) notFound();

    const jar = await cookies();
    const supplied = jar.get(`fc_guest_${orderNumber}`)?.value;
    if (!supplied || !/^[a-f0-9]{64}$/.test(supplied)) notFound();

    const expected = createHmac("sha256", secret)
      .update(`funky-culture-guest-order:${orderNumber}`)
      .digest("hex");

    if (!timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))) {
      notFound();
    }
  }

  const addr = order.address as { line1: string; line2?: string; city: string; state: string; pincode: string };
  const stepIdx = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);
  const cancelled = order.status === "cancelled" || order.status === "returned" || order.status === "refunded";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-32 sm:px-6">
      {placed && (
        <div className="mb-8 rounded-[2rem] border border-acid/40 bg-acid/[0.07] px-7 py-6 text-center">
          <p className="text-2xl">✦</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Order confirmed</h1>
          <p className="mt-1 text-sm text-fog">
            {order.paymentMethod === "cod"
              ? "Thanks! Pay by cash or UPI when your order arrives."
              : order.paymentStatus === "paid"
                ? "Payment verified. Your order is confirmed."
                : "Order created â€” payment confirmation pending."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Order</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-fog">
            Placed {order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`chip ${order.paymentStatus === "paid" ? "border-acid/50 text-acid" : ""}`}>
            {order.paymentMethod === "cod" ? "COD" : "Online"} · {order.paymentStatus}
          </span>
          <span className="chip" data-active>{ORDER_STATUS_LABELS[order.status]}</span>
        </div>
      </div>

      {/* status timeline */}
      {!cancelled ? (
        <ol aria-label="Order progress" className="surface-card mt-8 flex flex-wrap gap-y-4 !rounded-[2rem] p-7">
          {ORDER_STEPS.map((step, i) => {
            const done = i <= stepIdx;
            return (
              <li key={step} className="flex w-[33%] flex-col items-start gap-2 sm:w-auto sm:flex-1">
                <span className={`grid size-7 place-items-center rounded-full border text-[11px] font-bold ${done ? "border-acid bg-acid text-acid-ink" : "border-line text-fog"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className={`text-[11px] font-semibold leading-tight ${done ? "text-ivory" : "text-fog"}`}>
                  {ORDER_STATUS_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="surface-card mt-8 !rounded-[2rem] border-danger/30 p-7">
          <p className="font-bold text-danger">This order was {ORDER_STATUS_LABELS[order.status].toLowerCase()}.</p>
          <p className="mt-1 text-sm text-fog">Any paid amount is refunded to the original payment method within 5â€“7 business days.</p>
        </div>
      )}

      {order.trackingNumber && (
        <p className="mt-4 text-sm text-silver">
          Tracking number: <span className="font-bold text-acid">{order.trackingNumber}</span>
        </p>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="surface-card !rounded-[2rem] p-7" aria-labelledby="o-items">
          <h2 id="o-items" className="font-black">Items</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="relative block size-14 overflow-hidden rounded-2xl bg-charcoal">
                  {it.image && <Image src={it.image} alt={it.productName} fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{it.productName}</span>
                  <span className="text-xs text-fog">{it.size} · {it.color} · ×{it.qty}</span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatINR(it.price * it.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-fog">Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal)}</dd></div>
            {order.discount > 0 && <div className="flex justify-between text-acid"><dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt><dd className="tabular-nums">âˆ’{formatINR(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-fog">Shipping</dt><dd className="tabular-nums">{order.shippingFee === 0 ? "FREE" : formatINR(order.shippingFee)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 font-bold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.total)}</dd></div>
          </dl>
        </section>

        <section className="surface-card h-fit !rounded-[2rem] p-7" aria-labelledby="o-ship">
          <h2 id="o-ship" className="font-black">Delivery</h2>
          <address className="mt-4 text-sm not-italic leading-relaxed text-silver">
            <span className="font-bold text-ivory">{order.shippingName}</span><br />
            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}<br />
            {addr.city}, {addr.state} â€” {addr.pincode}<br />
            <span className="text-fog">{order.phone} · {order.email}</span>
          </address>
          {order.notes && <p className="mt-4 rounded-2xl bg-white/[0.03] p-3 text-xs text-fog">Note: {order.notes}</p>}
          <Link href="/shop" className="btn btn-ghost mt-6 w-full">Continue shopping</Link>
        </section>
      </div>

      {/* â”€â”€â”€ Delivery tracking timeline â”€â”€â”€ */}
      <DeliveryTimeline orderId={order.id} />
    </div>
  );
}

async function DeliveryTimeline({ orderId }: { orderId: string }) {
  const [assignment] = await db
    .select({
      id: deliveryAssignments.id,
      status: deliveryAssignments.status,
      driverName: drivers.name,
      assignedAt: deliveryAssignments.assignedAt,
      pickedUpAt: deliveryAssignments.pickedUpAt,
      deliveredAt: deliveryAssignments.deliveredAt,
      otpVerified: deliveryAssignments.otpVerified,
      deliveryOtp: deliveryAssignments.deliveryOtp,
      deliveryNotes: deliveryAssignments.deliveryNotes,
    })
    .from(deliveryAssignments)
    .innerJoin(drivers, eq(deliveryAssignments.driverId, drivers.id))
    .where(eq(deliveryAssignments.orderId, orderId))
    .orderBy(desc(deliveryAssignments.assignedAt))
    .limit(1);

  if (!assignment) return null;

  const events = await db
    .select({
      id: deliveryEvents.id,
      status: deliveryEvents.status,
      note: deliveryEvents.note,
      createdAt: deliveryEvents.createdAt,
    })
    .from(deliveryEvents)
    .where(eq(deliveryEvents.assignmentId, assignment.id))
    .orderBy(desc(deliveryEvents.createdAt));

  const isFinished = ["delivered", "cancelled", "returned_to_store"].includes(assignment.status);

  return (
    <section className="mt-8 surface-card !rounded-[2rem] p-7" aria-labelledby="dt-h">
      <DeliveryTrackingLive status={assignment.status} isFinished={isFinished} />
      <h2 id="dt-h" className="font-black">Live Delivery Tracking</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="grid size-10 place-items-center rounded-full bg-white/10 text-xs font-black">🚚</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate">{assignment.driverName}</p>
          <p className="text-xs text-fog">{DELIVERY_STATUS_LABELS[assignment.status] ?? assignment.status}</p>
        </div>
        {assignment.status !== "delivered" && (
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Delivery OTP</p>
            <p className="font-mono text-sm font-black tracking-[0.2em] text-white">{(assignment as any).deliveryOtp || "---"}</p>
          </div>
        )}
        {assignment.otpVerified && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold">OTP Verified ✓</span>
        )}
      </div>

      {events.length > 0 && (
        <ol className="mt-6 flex flex-col gap-4 border-l border-white/[0.08] pl-6">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full bg-white/40" />
              <p className="text-sm font-semibold">{DELIVERY_STATUS_LABELS[ev.status] ?? ev.status}</p>
              {ev.note && <p className="mt-0.5 text-xs text-fog">{ev.note}</p>}
              <p className="mt-0.5 text-[10px] text-fog/50">{ev.createdAt.toLocaleString("en-IN")}</p>
            </li>
          ))}
        </ol>
      )}

      {assignment.deliveryNotes && (
        <p className="mt-4 rounded-2xl bg-white/[0.03] p-3 text-xs text-fog">Driver note: {assignment.deliveryNotes}</p>
      )}
    </section>
  );
}

