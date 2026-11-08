import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import {
  cartItems,
  coupons,
  orders,
  orderItems,
  payments,
  productVariants,
  products,
  productImages,
  notifications,
  siteSettings,
  users,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getCart } from "@/lib/cart";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_SHIPPING, type ShippingSettings } from "@/lib/settings";
import { sendNotification } from "@/lib/notifications";
import { isValidEmail, isValidPhone, isValidPincode, orderNumber, rateLimit } from "@/lib/utils";

function guestOrderCookieValue(orderNum: string): string {
  const secret = process.env.GUEST_ORDER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("GUEST_ORDER_SECRET is missing or too short.");
  }
  return createHmac("sha256", secret).update(`funky-culture-guest-order:${orderNum}`).digest("hex");
}

function attachGuestOrderCookie(response: NextResponse, orderNum: string): NextResponse {
  response.cookies.set(`fc_guest_${orderNum}`, guestOrderCookieValue(orderNum), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/order/${orderNum}`,
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
const checkoutSchema = z.object({
  method: z.enum(["cod", "razorpay"]),
  name: z.string().min(2).max(100),
  email: z.string().email().max(120),
  phone: z.string().min(10).max(15),
  phoneConfirmed: z.boolean(),
  line1: z.string().min(3).max(160),
  line2: z.string().max(160).optional().default(""),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().length(6),
  notes: z.string().max(500).optional().default(""),
  coupon: z.string().max(40).optional().default(""),
  saveAddress: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(8).max(80),
});

async function getShipping(): Promise<ShippingSettings> {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, "shipping")).limit(1);
  return rows[0] ? { ...DEFAULT_SHIPPING, ...(rows[0].value as Partial<ShippingSettings>) } : DEFAULT_SHIPPING;
}

async function createRazorpayOrder(amount: number, receipt: string) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Razorpay order creation failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

/** Shared function: runs the DB transaction to create order, deduct stock, clear cart */
async function finalizeOrder(
  cart: Awaited<ReturnType<typeof getCart>>,
  body: z.infer<typeof checkoutSchema>,
  num: string,
  user: { id: string } | null,
  subtotal: number,
  discount: number,
  shippingFee: number,
  total: number,
  couponRow: typeof coupons.$inferSelect | null,
  addressSnapshot: Record<string, string>,
  razorpayOrderId: string | null = null,
) {
  return db.transaction(async (tx) => {
    // Atomic stock deduction â€” prevents overselling
    for (const line of cart.lines) {
      const res = await tx.execute(sql`
        UPDATE product_variants
        SET stock = stock - ${line.qty}
        WHERE id = ${line.variantId} AND stock >= ${line.qty}
        RETURNING id
      `);
      if (res.rows.length === 0) {
        throw new Error(`OUT_OF_STOCK:${line.name}`);
      }
    }

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: num,
        userId: user?.id ?? null,
        email: body.email.toLowerCase(),
        phone: body.phone,
        shippingName: body.name,
        address: addressSnapshot,
        status: body.method === "cod" ? "confirmed" : "pending",
        paymentMethod: body.method,
        paymentStatus: "pending",
        subtotal,
        discount,
        shippingFee,
        total,
        couponCode: couponRow?.code ?? null,
        notes: body.notes || null,
        idempotencyKey: body.idempotencyKey,
      })
      .returning();

    // Record the payment intent if it's Razorpay
    if (body.method === "razorpay" && razorpayOrderId) {
      await tx.insert(payments).values({
        orderId: order.id,
        provider: "razorpay",
        providerOrderId: razorpayOrderId,
        status: "pending",
        amount: total,
      });
    }

    // Images for order item snapshots
    const productIds = [...new Set(cart.lines.map((l) => l.productId))];
    const images = productIds.length
      ? await tx.select().from(productImages).where(inArray(productImages.productId, productIds))
      : [];
    const imgByProduct = new Map<string, string>();
    for (const img of images.sort((a, b) => a.sort - b.sort)) {
      if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img.url);
    }

    await tx.insert(orderItems).values(
      cart.lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        productName: l.name,
        size: l.size,
        color: l.colorName,
        price: l.unitPrice,
        qty: l.qty,
        image: imgByProduct.get(l.productId) ?? null,
      }))
    );

    await sendNotification({
      userId: user?.id ?? null,
      type: "order",
      title: `Order ${num} placed`,
      body:
        body.method === "cod"
          ? `Your order is confirmed. Pay ₹${(total / 100).toLocaleString("en-IN")} on delivery.`
          : "Your order is awaiting payment confirmation.",
    });

    // Inventory ledger entries
    for (const line of cart.lines) {
      await tx.execute(sql`
        INSERT INTO inventory_transactions (variant_id, change, reason, order_id)
        VALUES (${line.variantId}, ${-line.qty}, ${"order"}, ${order.id})
      `);
    }

    if (couponRow) {
      await tx.update(coupons).set({ usedCount: couponRow.usedCount + 1 }).where(eq(coupons.id, couponRow.id));
    }

    // Clear cart ONLY AFTER successful order creation
    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.cartId!));

    // Optional: save address
    if (body.saveAddress && user) {
      await tx.execute(sql`
        INSERT INTO addresses (user_id, full_name, phone, line1, line2, city, state, pincode, is_default)
        VALUES (${user.id}, ${body.name}, ${body.phone}, ${body.line1}, ${body.line2}, ${body.city}, ${body.state}, ${body.pincode}, false)
      `);
    }

    return order.id;
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in before placing an order.", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`checkout:${ip}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
    }

    const body = checkoutSchema.parse(await req.json());
    if (!body.phoneConfirmed) return NextResponse.json({ error: "Please confirm that your mobile number is correct." }, { status: 400 });
    if (!isValidEmail(body.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!isValidPhone(body.phone)) return NextResponse.json({ error: "Enter a valid 10-digit Indian phone number." }, { status: 400 });
    if (!isValidPincode(body.pincode)) return NextResponse.json({ error: "Enter a valid 6-digit PIN code." }, { status: 400 });

    const shipping = await getShipping();
    if (body.method === "cod" && !shipping.codEnabled) {
      return NextResponse.json({ error: "Cash on Delivery is currently unavailable." }, { status: 400 });
    }

    // Idempotency: return existing order for repeat submissions
    const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, body.idempotencyKey)).limit(1);
    if (existing[0]) {
      const response = NextResponse.json({ ok: true, orderNumber: existing[0].orderNumber, duplicate: true });
      if (!existing[0].userId) {
        const cookieName = `fc_guest_${existing[0].orderNumber}`;
        const suppliedCookie = req.cookies.get(cookieName)?.value;
        const expectedCookie = guestOrderCookieValue(existing[0].orderNumber);
        if (suppliedCookie && suppliedCookie === expectedCookie) {
          response.cookies.set(cookieName, expectedCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: `/order/${existing[0].orderNumber}`,
            maxAge: 60 * 60 * 24 * 30,
          });
        }
      }
      return response;
    }

    const cart = await getCart();
    if (!cart.cartId || cart.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    // Stock pre-validation (read-only check before any mutation)
    for (const line of cart.lines) {
      if (line.stock < line.qty) {
        return NextResponse.json(
          { error: `"${line.name}" (${line.size}/${line.colorName}) has only ${line.stock} left.` },
          { status: 400 }
        );
      }
    }

    const subtotal = cart.subtotal;

    // Server-side coupon validation
    let discount = 0;
    let couponRow: typeof coupons.$inferSelect | null = null;
    if (body.coupon) {
      const code = body.coupon.trim().toUpperCase();
      const found = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
      couponRow = found[0] ?? null;
      if (
        couponRow &&
        couponRow.active &&
        (!couponRow.expiresAt || couponRow.expiresAt > new Date()) &&
        (couponRow.maxUses == null || couponRow.usedCount < couponRow.maxUses) &&
        subtotal >= couponRow.minOrder
      ) {
        discount =
          couponRow.type === "percent"
            ? Math.min(Math.round((subtotal * couponRow.value) / 100), subtotal)
            : Math.min(couponRow.value, subtotal);
      } else {
        return NextResponse.json({ error: "Coupon code is invalid, expired, or minimum order not met." }, { status: 400 });
      }
    }

    const shippingFee = subtotal - discount >= shipping.freeOver ? 0 : shipping.fee;
    const total = subtotal - discount + shippingFee;
    const num = orderNumber();
    const addressSnapshot = {
      line1: body.line1,
      line2: body.line2,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
    };

    // â”€â”€â”€ COD PATH: finalize immediately â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (body.method === "cod") {
      await finalizeOrder(cart, body, num, user, subtotal, discount, shippingFee, total, couponRow, addressSnapshot);
      const response = NextResponse.json({ ok: true, orderNumber: num, method: "cod" });
      return user ? response : attachGuestOrderCookie(response, num);
    }

    // â”€â”€â”€ RAZORPAY PATH: create payment order FIRST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Step 1: Create the Razorpay order BEFORE touching stock/cart.
    // If this fails, the customer keeps their cart and stock is untouched.
    let rpOrder: { id: string; amount: number; currency: string } | null = null;
    try {
      rpOrder = await createRazorpayOrder(total, num);
    } catch (payErr) {
      console.error("[razorpay:create]", payErr);
      return NextResponse.json(
        { error: "Could not initialise online payment. Please try again or choose Cash on Delivery." },
        { status: 502 }
      );
    }

    if (!rpOrder) {
      return NextResponse.json(
        { error: "Online payments are not configured yet. Please choose Cash on Delivery.", code: "PAYMENTS_NOT_CONFIGURED" },
        { status: 503 }
      );
    }

    // Step 2: Razorpay order created successfully.
    // NOW run the DB transaction to deduct stock, create order, record payment intent, and clear cart.
    try {
      await finalizeOrder(cart, body, num, user, subtotal, discount, shippingFee, total, couponRow, addressSnapshot, rpOrder.id);
    } catch (err) {
      console.error("[checkout:finalize]", err);
      // If our DB fails, the customer still has their cart and stock is not deducted.
      // We don't return the Razorpay order because we couldn't record the intent locally.
      return NextResponse.json(
        { error: "Order could not be saved. Please try again." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      orderNumber: num,
      method: "razorpay",
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: rpOrder.id,
        amount: total,
        currency: "INR",
      },
    });
    return user ? response : attachGuestOrderCookie(response, num);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Please check your details: " + (err.issues[0]?.message ?? "invalid input") }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("OUT_OF_STOCK:")) {
      return NextResponse.json(
        { error: `"${err.message.split(":")[1]}" just sold out. Please update your cart.` },
        { status: 409 }
      );
    }
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}

