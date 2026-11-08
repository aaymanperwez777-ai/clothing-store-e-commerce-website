import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  orders,
  orderItems,
  products,
  productImages,
  productVariants,
  categories,
  coupons,
  reviews,
  inventoryTransactions,
  payments,
  deliveryAssignments,
} from "@/db/schema";
import { eq, desc, sql, and, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { slugify } from "@/lib/utils";

const productInput = z.object({
  name: z.string().min(2).max(180),
  description: z.string().max(12000).default(""),
  brand: z.string().max(120).default("CLOTHING STORE"),
  price: z.number().int().min(1),
  salePrice: z.number().int().min(0).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(40)).max(40).default([]),
  featured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  active: z.boolean().default(true),
  images: z.array(z.string().max(1000)).max(24).default([]),
  variants: z
    .array(
      z.object({
        size: z.string().min(1).max(20),
        colorName: z.string().min(1).max(60),
        colorHex: z.string().max(10).default("#888888"),
        stock: z.number().int().min(0).max(100000),
      })
    )
    .min(1)
    .max(200),
});

const categoryInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(600).default(""),
  image: z.string().max(1000).optional().nullable(),
  sort: z.number().int().min(-10000).max(10000).optional(),
});

async function guard() {
  const admin = await requireAdmin();
  return admin;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resource } = await ctx.params;

  if (resource === "overview") {
    const [revenue] = await db
      .select({ total: sql<number>`coalesce(sum(${orders.total}),0)` })
      .from(orders)
      .where(and(sql`${orders.status} NOT IN ('cancelled','refunded')`, sql`${orders.paymentStatus} != 'failed'`));
    const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const [pending] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(sql`${orders.status} IN ('pending','confirmed','processing')`);
    const [delivered] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "delivered"));
    const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "customer"));
    const [avgOrderValue] = await db
      .select({ total: sql<number>`coalesce(avg(${orders.total}),0)` })
      .from(orders)
      .where(and(sql`${orders.status} NOT IN ('cancelled','refunded')`, sql`${orders.paymentStatus} != 'failed'`));
    
    const [pendingDeliveries] = await db.select({ count: sql<number>`count(*)` }).from(deliveryAssignments).where(sql`${deliveryAssignments.status} NOT IN ('delivered','cancelled','returned_to_store')`);
    const [completedDeliveries] = await db.select({ count: sql<number>`count(*)` }).from(deliveryAssignments).where(eq(deliveryAssignments.status, "delivered"));

    const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
    const best = await db
      .select({ name: orderItems.productName, qty: sql<number>`sum(${orderItems.qty})`, revenue: sql<number>`sum(${orderItems.price} * ${orderItems.qty})` })
      .from(orderItems)
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.qty})`))
      .limit(5);
    const low = await db
      .select({
        id: productVariants.id,
        product: products.name,
        size: productVariants.size,
        color: productVariants.colorName,
        stock: productVariants.stock,
        sku: productVariants.sku,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(sql`${productVariants.stock} <= 3`)
      .orderBy(asc(productVariants.stock))
      .limit(10);
    const daily = await db
      .select({ day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`, total: sql<number>`coalesce(sum(${orders.total}),0)` })
      .from(orders)
      .where(sql`${orders.createdAt} > now() - interval '14 days' AND ${orders.status} NOT IN ('cancelled','refunded')`)
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);
    return NextResponse.json({
      revenue: Number(revenue?.total ?? 0),
      orders: Number(orderCount?.count ?? 0),
      pending: Number(pending?.count ?? 0),
      delivered: Number(delivered?.count ?? 0),
      customers: Number(customerCount?.count ?? 0),
      avgOrderValue: Number(avgOrderValue?.total ?? 0),
      pendingDeliveries: Number(pendingDeliveries?.count ?? 0),
      completedDeliveries: Number(completedDeliveries?.count ?? 0),
      recent,
      best,
      low,
      daily,
    });
  }

  if (resource === "products") {
    const rows = await db.query.products.findMany({
      orderBy: [desc(products.createdAt)],
      with: { images: { orderBy: [asc(productImages.sort)] }, variants: true, category: true },
    });
    return NextResponse.json({ products: rows });
  }

  if (resource === "orders") {
    const rows = await db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      with: { items: true, payments: true },
      limit: 200,
    });
    return NextResponse.json({ orders: rows });
  }

  if (resource === "customers") {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        role: users.role,
        orderCount: sql<number>`(select count(*) from orders o where o.user_id = "users"."id")`,
        totalSpent: sql<number>`(select coalesce(sum(o.total),0) from orders o where o.user_id = "users"."id" and o.status NOT IN ('cancelled','refunded'))`,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(300);
    return NextResponse.json({ customers: rows });
  }

  if (resource === "coupons") {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    return NextResponse.json({ coupons: rows });
  }

  if (resource === "reviews") {
    const rows = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        approved: reviews.approved,
        createdAt: reviews.createdAt,
        user: users.name,
        product: products.name,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(products, eq(reviews.productId, products.id))
      .orderBy(desc(reviews.createdAt))
      .limit(200);
    return NextResponse.json({ reviews: rows });
  }

  if (resource === "inventory") {
    const rows = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.colorName,
        stock: productVariants.stock,
        product: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .orderBy(asc(productVariants.stock))
      .limit(300);
    return NextResponse.json({ inventory: rows });
  }

  if (resource === "categories") {
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        image: categories.image,
        sort: categories.sort,
        createdAt: categories.createdAt,
        productCount: sql<number>`(select count(*) from ${products} where ${products.categoryId} = ${categories.id})`,
      })
      .from(categories)
      .orderBy(asc(categories.sort), asc(categories.name));
    return NextResponse.json({ categories: rows });
  }

  return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resource } = await ctx.params;

  try {
    if (resource === "products") {
      const raw = await req.json();

      if (raw.action === "duplicate") {
        const input = z.object({ id: z.string().uuid() }).parse(raw);
        const source = await db.query.products.findFirst({
          where: eq(products.id, input.id),
          with: { images: { orderBy: [asc(productImages.sort)] }, variants: true },
        });
        if (!source) return NextResponse.json({ error: "Source product not found." }, { status: 404 });

        const base = slugify(source.name + " copy");
        const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const created = await db.transaction(async (tx) => {
          const [p] = await tx.insert(products).values({
            name: `${source.name} Copy`,
            slug,
            description: source.description,
            brand: source.brand,
            price: source.price,
            salePrice: source.salePrice,
            categoryId: source.categoryId,
            tags: source.tags,
            featured: false,
            isNew: false,
            active: false,
          }).returning();

          if (source.images.length) {
            await tx.insert(productImages).values(source.images.map((img, i) => ({ productId: p.id, url: img.url, alt: img.alt || `${source.name} Copy`, sort: i })));
          }

          for (const v of source.variants) {
            const sku = `FC-${base.slice(0, 10).toUpperCase()}-${v.colorName.slice(0, 3).toUpperCase()}-${v.size}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`.replace(/[^A-Z0-9-]/g, "");
            await tx.insert(productVariants).values({
              productId: p.id,
              size: v.size,
              colorName: v.colorName,
              colorHex: v.colorHex,
              sku,
              stock: 0,
            });
          }
          return p;
        });
        return NextResponse.json({ ok: true, product: created });
      }

      const input = productInput.parse(raw);
      const base = slugify(input.name);
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const created = await db.transaction(async (tx) => {
        const [p] = await tx
          .insert(products)
          .values({
            name: input.name,
            slug,
            description: input.description,
            brand: input.brand,
            price: input.price,
            salePrice: input.salePrice || null,
            categoryId: input.categoryId || null,
            tags: input.tags,
            featured: input.featured,
            isNew: input.isNew,
            active: input.active,
          })
          .returning();
        if (input.images.length) {
          await tx.insert(productImages).values(
            input.images.map((url, i) => ({ productId: p.id, url, alt: input.name, sort: i }))
          );
        }
        for (const v of input.variants) {
          const sku = `FC-${base.slice(0, 10).toUpperCase()}-${v.colorName.slice(0, 3).toUpperCase()}-${v.size}`.replace(/[^A-Z0-9-]/g, "");
          const [variant] = await tx
            .insert(productVariants)
            .values({ productId: p.id, size: v.size.toUpperCase(), colorName: v.colorName, colorHex: v.colorHex, sku, stock: v.stock })
            .returning();
          await tx.insert(inventoryTransactions).values({ variantId: variant.id, change: v.stock, reason: "initial_stock" });
        }
        return p;
      });
      return NextResponse.json({ ok: true, product: created });
    }

    if (resource === "coupons") {
      const input = z
        .object({
          code: z.string().min(3).max(40),
          type: z.enum(["percent", "fixed"]),
          value: z.number().int().min(1),
          minOrder: z.number().int().min(0).default(0),
          maxUses: z.number().int().min(1).nullable().optional(),
          expiresAt: z.string().nullable().optional(),
        })
        .parse(await req.json());
      const [c] = await db
        .insert(coupons)
        .values({
          code: input.code.toUpperCase(),
          type: input.type,
          value: input.value,
          minOrder: input.minOrder,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
        .onConflictDoNothing()
        .returning();
      if (!c) return NextResponse.json({ error: "Coupon code already exists." }, { status: 409 });
      return NextResponse.json({ ok: true, coupon: c });
    }

    if (resource === "restock") {
      const input = z
        .object({ variantId: z.string().uuid(), change: z.number().int().min(-10000).max(10000), reason: z.string().max(120).default("manual_adjustment") })
        .parse(await req.json());
      if (input.change === 0) return NextResponse.json({ error: "Change must be non-zero." }, { status: 400 });
      const res = await db.transaction(async (tx) => {
        const out = await tx.execute(sql`
          UPDATE product_variants SET stock = stock + ${input.change}
          WHERE id = ${input.variantId} AND stock + ${input.change} >= 0
          RETURNING stock
        `);
        if (out.rows.length === 0) throw new Error("Stock cannot go below zero.");
        await tx.insert(inventoryTransactions).values({ variantId: input.variantId, change: input.change, reason: input.reason });
        return out.rows[0];
      });
      return NextResponse.json({ ok: true, result: res });
    }

    if (resource === "categories") {
      const input = categoryInput.parse(await req.json());
      const [c] = await db
        .insert(categories)
        .values({
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description,
          image: input.image ?? null,
          sort: input.sort ?? 0,
        })
        .onConflictDoNothing()
        .returning();
      if (!c) return NextResponse.json({ error: "Category already exists." }, { status: 409 });
      return NextResponse.json({ ok: true, category: c });
    }

    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error(`[admin:${resource}]`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resource } = await ctx.params;

  try {
    if (resource === "products") {
      const input = productInput.extend({ id: z.string().uuid() }).parse(await req.json());
      await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({
            name: input.name,
            description: input.description,
            brand: input.brand,
            price: input.price,
            salePrice: input.salePrice || null,
            categoryId: input.categoryId || null,
            tags: input.tags,
            featured: input.featured,
            isNew: input.isNew,
            active: input.active,
          })
          .where(eq(products.id, input.id));
        // replace images
        await tx.delete(productImages).where(eq(productImages.productId, input.id));
        if (input.images.length) {
          await tx.insert(productImages).values(input.images.map((url, i) => ({ productId: input.id, url, alt: input.name, sort: i })));
        }
        // upsert variants by size+color
        const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, input.id));
        const seen = new Set<string>();
        for (const v of input.variants) {
          const key = `${v.size.toUpperCase()}|${v.colorName}`;
          seen.add(key);
          const match = existing.find((e) => e.size === v.size.toUpperCase() && e.colorName === v.colorName);
          if (match) {
            const diff = v.stock - match.stock;
            await tx.update(productVariants).set({ stock: v.stock, colorHex: v.colorHex }).where(eq(productVariants.id, match.id));
            if (diff !== 0) await tx.insert(inventoryTransactions).values({ variantId: match.id, change: diff, reason: "admin_edit" });
          } else {
            const sku = `FC-${slugify(input.name).slice(0, 10).toUpperCase()}-${v.colorName.slice(0, 3).toUpperCase()}-${v.size.toUpperCase()}`.replace(/[^A-Z0-9-]/g, "");
            const [variant] = await tx
              .insert(productVariants)
              .values({ productId: input.id, size: v.size.toUpperCase(), colorName: v.colorName, colorHex: v.colorHex, sku, stock: v.stock })
              .returning();
            await tx.insert(inventoryTransactions).values({ variantId: variant.id, change: v.stock, reason: "variant_added" });
          }
        }
        for (const e of existing) {
          if (!seen.has(`${e.size}|${e.colorName}`)) {
            await tx.delete(inventoryTransactions).where(eq(inventoryTransactions.variantId, e.id));
            await tx.delete(productVariants).where(eq(productVariants.id, e.id));
          }
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (resource === "settings") {
      const input = z.object({ key: z.string().min(1).max(60), value: z.unknown() }).parse(await req.json());
      await setSetting(input.key, input.value);
      return NextResponse.json({ ok: true });
    }

    if (resource === "categories") {
      const input = categoryInput.extend({ id: z.string().uuid() }).parse(await req.json());
      await db
        .update(categories)
        .set({
          name: input.name.trim(),
          slug: slugify(input.name),
          description: input.description,
          image: input.image ?? null,
          sort: input.sort ?? 0,
        })
        .where(eq(categories.id, input.id));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    console.error(`[admin:${resource}]`, err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resource } = await ctx.params;

  try {
    if (resource === "orders") {
      const input = z
        .object({
          id: z.string().uuid(),
          status: z
            .enum(["pending", "confirmed", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned", "refunded"])
            .optional(),
          trackingNumber: z.string().max(80).nullable().optional(),
        })
        .parse(await req.json());

      const [order] = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

      await db.transaction(async (tx) => {
        const updates: Partial<typeof orders.$inferInsert> = { updatedAt: new Date() };
        if (input.status) updates.status = input.status;
        if (input.trackingNumber !== undefined) updates.trackingNumber = input.trackingNumber;

        // Cancel / refund handling with restock
        if ((input.status === "cancelled" || input.status === "refunded") && order.status !== "cancelled" && order.status !== "refunded") {
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
          for (const item of items) {
            if (!item.variantId) continue;
            await tx.execute(sql`UPDATE product_variants SET stock = stock + ${item.qty} WHERE id = ${item.variantId}`);
            await tx.insert(inventoryTransactions).values({
              variantId: item.variantId,
              change: item.qty,
              reason: input.status === "cancelled" ? "order_cancelled" : "order_refunded",
              orderId: order.id,
            });
          }
          if (input.status === "refunded") updates.paymentStatus = "refunded";
        }
        // COD delivered ⇒ payment collected
        if (input.status === "delivered" && order.paymentMethod === "cod") {
          updates.paymentStatus = "paid";
        }
        await tx.update(orders).set(updates).where(eq(orders.id, order.id));
      });
      return NextResponse.json({ ok: true });
    }

    if (resource === "coupons") {
      const input = z.object({ id: z.string().uuid(), active: z.boolean() }).parse(await req.json());
      await db.update(coupons).set({ active: input.active }).where(eq(coupons.id, input.id));
      return NextResponse.json({ ok: true });
    }

    if (resource === "reviews") {
      const input = z.object({ id: z.string().uuid(), approved: z.boolean() }).parse(await req.json());
      await db.update(reviews).set({ approved: input.approved }).where(eq(reviews.id, input.id));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    console.error(`[admin:${resource}]`, err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ resource: string }> }) {
  if (!(await guard())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { resource } = await ctx.params;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (resource === "products" && id) {
      await db.delete(products).where(eq(products.id, id));
      return NextResponse.json({ ok: true });
    }
    if (resource === "reviews" && id) {
      await db.delete(reviews).where(eq(reviews.id, id));
      return NextResponse.json({ ok: true });
    }
    if (resource === "categories" && id) {
      await db.delete(categories).where(eq(categories.id, id));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  } catch (err) {
    console.error(`[admin:${resource}]`, err);
    return NextResponse.json({ error: "Failed." }, { status: 500 });
  }
}
