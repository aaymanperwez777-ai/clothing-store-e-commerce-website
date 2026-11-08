import type { Metadata } from "next";
import { db } from "@/db";
import { addresses, orders, wishlists, products, productImages, productVariants, notifications } from "@/db/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { AuthForms, AccountView, AccountSwitcher } from "@/components/account-client";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in to CLOTHING STORE to track orders, manage addresses and your wishlist.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const resetToken = sp.reset ?? null;
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <AccountSwitcher currentUserId={null} />
        <div className="mx-auto max-w-md px-4 pb-24 pt-36 sm:px-6">
        <p className="kicker text-center">Members zone</p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight">
          {resetToken ? "Set a new password" : "Your account"}
        </h1>
        <AuthForms resetToken={resetToken} />
        </div>
      </>
    );
  }

  const [userOrders, userAddresses, wishRows, notifs] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.userId, user.id),
      orderBy: [desc(orders.createdAt)],
      with: { items: true },
      limit: 30,
    }),
    db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.isDefault)),
    db.select().from(wishlists).where(eq(wishlists.userId, user.id)).orderBy(desc(wishlists.createdAt)),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(10),
  ]);

  const wishProductIds = wishRows.map((w) => w.productId);
  const wishProducts = wishProductIds.length
    ? await db
        .select()
        .from(products)
        .where(inArray(products.id, wishProductIds))
    : [];
  const wishImages = wishProductIds.length
    ? await db.select().from(productImages).where(inArray(productImages.productId, wishProductIds)).orderBy(asc(productImages.sort))
    : [];
  const wishVariants = wishProductIds.length
    ? await db.select().from(productVariants).where(inArray(productVariants.productId, wishProductIds))
    : [];
  const imgMap = new Map<string, string>();
  for (const img of wishImages) if (!imgMap.has(img.productId)) imgMap.set(img.productId, img.url);

  return (
    <>
    <AccountSwitcher currentUserId={user.id} />
    <AccountView
      user={user}
      orders={userOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        total: o.total,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((i) => ({ id: i.id, name: i.productName, qty: i.qty, size: i.size, image: i.image })),
      }))}
      addresses={userAddresses.map((a) => ({
        id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, pincode: a.pincode,
      }))}
      wishlist={wishProducts.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        salePrice: p.salePrice,
        image: imgMap.get(p.id) ?? null,
        inStock: wishVariants.some((v) => v.productId === p.id && v.stock > 0),
      }))}
      notifications={notifs.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString(), read: n.read }))}
    />
    </>
  );
}
