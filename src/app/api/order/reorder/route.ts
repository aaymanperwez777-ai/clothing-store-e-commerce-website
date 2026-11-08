import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { orders, orderItems, cartItems, productVariants, products } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getOrCreateCart, getCart } from "@/lib/cart";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = z.object({ orderId: z.string().uuid() }).parse(await req.json());
    const [order] = await db
      .select({ id: orders.id, userId: orders.userId, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, body.orderId))
      .limit(1);

    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, body.orderId));
    const { cartId } = await getOrCreateCart();

    let added = 0;
    let skipped = 0;
    const messages: string[] = [];

    for (const item of items) {
      if (!item.variantId) {
        skipped++;
        messages.push(`${item.productName}: variant no longer exists`);
        continue;
      }

      const [variant] = await db
        .select({ id: productVariants.id, stock: productVariants.stock, active: products.active })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(productVariants.id, item.variantId))
        .limit(1);

      if (!variant || !variant.active || variant.stock < 1) {
        skipped++;
        messages.push(`${item.productName}: out of stock`);
        continue;
      }

      const [existing] = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, item.variantId)))
        .limit(1);

      const nextQty = Math.min((existing?.qty ?? 0) + item.qty, variant.stock, 10);
      if (existing) {
        await db.update(cartItems).set({ qty: nextQty }).where(eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems).values({ cartId, variantId: item.variantId, qty: Math.min(item.qty, variant.stock, 10) });
      }
      added++;
    }

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      added,
      skipped,
      messages,
      cart: await getCart(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    console.error("[order:reorder]", err);
    return NextResponse.json({ error: "Could not re-order items." }, { status: 500 });
  }
}
