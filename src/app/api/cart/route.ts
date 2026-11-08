import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cartItems, productVariants, products } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getOrCreateCart, getCart } from "@/lib/cart";
import { rateLimit } from "@/lib/utils";
import { headers } from "next/headers";

export async function GET() {
  return NextResponse.json(await getCart());
}

export async function POST(req: NextRequest) {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`cart:${ip}`, 120, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    const body = z
      .object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(10) })
      .parse(await req.json());

    // Validate variant is purchasable
    const [row] = await db
      .select({ stock: productVariants.stock, active: products.active })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, body.variantId))
      .limit(1);
    if (!row || !row.active) return NextResponse.json({ error: "This item is unavailable." }, { status: 400 });
    if (row.stock < 1) return NextResponse.json({ error: "This item is out of stock." }, { status: 400 });

    const { cartId } = await getOrCreateCart();
    const [existing] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, body.variantId)))
      .limit(1);

    const newQty = (existing?.qty ?? 0) + body.qty;
    if (newQty > row.stock) {
      return NextResponse.json({ error: `Only ${row.stock} left in stock for this variant.` }, { status: 400 });
    }

    if (existing) {
      await db.update(cartItems).set({ qty: newQty }).where(eq(cartItems.id, existing.id));
    } else {
      await db.insert(cartItems).values({ cartId, variantId: body.variantId, qty: body.qty });
    }
    return NextResponse.json(await getCart());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    console.error("[cart:add]", err);
    return NextResponse.json({ error: "Could not add to cart." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = z.object({ itemId: z.string().uuid(), qty: z.number().int().min(0).max(10) }).parse(await req.json());
    const { cartId } = await getOrCreateCart();
    const [item] = await db.select().from(cartItems).where(eq(cartItems.id, body.itemId)).limit(1);
    if (!item || item.cartId !== cartId) return NextResponse.json({ error: "Item not found." }, { status: 404 });
    if (body.qty === 0) {
      await db.delete(cartItems).where(eq(cartItems.id, body.itemId));
    } else {
      const [variant] = await db.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, item.variantId));
      if (variant && body.qty > variant.stock) {
        return NextResponse.json({ error: `Only ${variant.stock} left in stock.` }, { status: 400 });
      }
      await db.update(cartItems).set({ qty: body.qty }).where(eq(cartItems.id, body.itemId));
    }
    await db.execute(sql`UPDATE carts SET updated_at = now() WHERE id = ${cartId}`);
    return NextResponse.json(await getCart());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    console.error("[cart:update]", err);
    return NextResponse.json({ error: "Could not update cart." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = z.object({ itemId: z.string().uuid() }).parse(await req.json());
    const { cartId } = await getOrCreateCart();
    await db.delete(cartItems).where(and(eq(cartItems.id, body.itemId), eq(cartItems.cartId, cartId)));
    return NextResponse.json(await getCart());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    console.error("[cart:remove]", err);
    return NextResponse.json({ error: "Could not remove item." }, { status: 500 });
  }
}
