import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db } from "@/db";
import { carts, cartItems, productVariants, products, productImages } from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";

export const CART_COOKIE = "fc_cart";

export type CartLine = {
  itemId: string;
  variantId: string;
  qty: number;
  size: string;
  colorName: string;
  colorHex: string;
  stock: number;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  salePrice: number | null;
  unitPrice: number; // effective
};

export type CartData = {
  cartId: string | null;
  lines: CartLine[];
  subtotal: number;
  count: number;
};

export async function getOrCreateCart(): Promise<{ cartId: string; token: string }> {
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;
  if (token) {
    const existing = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
    if (existing[0]) return { cartId: existing[0].id, token };
  }
  token = crypto.randomBytes(24).toString("hex");
  const [created] = await db.insert(carts).values({ token }).returning();
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  return { cartId: created.id, token };
}

export async function getCart(): Promise<CartData> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return { cartId: null, lines: [], subtotal: 0, count: 0 };
  const cart = (await db.select().from(carts).where(eq(carts.token, token)).limit(1))[0];
  if (!cart) return { cartId: null, lines: [], subtotal: 0, count: 0 };

  const rows = await db
    .select({
      itemId: cartItems.id,
      variantId: cartItems.variantId,
      qty: cartItems.qty,
      size: productVariants.size,
      colorName: productVariants.colorName,
      colorHex: productVariants.colorHex,
      stock: productVariants.stock,
      productId: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      salePrice: products.salePrice,
      active: products.active,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(cartItems.cartId, cart.id));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const images = productIds.length
    ? await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.sort))
    : [];
  const imgByProduct = new Map<string, string>();
  for (const img of images) if (!imgByProduct.has(img.productId)) imgByProduct.set(img.productId, img.url);

  const lines: CartLine[] = rows
    .filter((r) => r.active)
    .map((r) => ({
      itemId: r.itemId,
      variantId: r.variantId,
      qty: r.qty,
      size: r.size,
      colorName: r.colorName,
      colorHex: r.colorHex,
      stock: r.stock,
      productId: r.productId,
      name: r.name,
      slug: r.slug,
      image: imgByProduct.get(r.productId) ?? null,
      price: r.price,
      salePrice: r.salePrice,
      unitPrice: r.salePrice != null && r.salePrice < r.price ? r.salePrice : r.price,
    }));

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  return { cartId: cart.id, lines, subtotal, count };
}
