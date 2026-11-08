import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { products, reviews, users } from "@/db/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { effectivePrice, formatINR } from "@/lib/utils";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { RecentlyViewed } from "@/components/recent";
import { Reveal } from "@/components/motion";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  return db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      images: { orderBy: (t, { asc }) => [asc(t.sort)] },
      variants: true,
      category: true,
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Product not found", robots: { index: false, follow: false } };

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const productUrl = `${siteUrl}/product/${p.slug}`;
  const productName = p.name.replace(/\s+/g, " ").trim();
  const rawDescription = p.description.trim();
  const desc = (rawDescription.length >= 40 ? rawDescription : `${productName} at CLOTHING STORE. ${rawDescription || "Explore product details and availability online."}`).slice(0, 155);
  const image = p.images[0]?.url ? new URL(p.images[0].url, siteUrl).toString() : undefined;

  return {
    title: productName,
    description: desc,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: {
      title: productName,
      description: desc,
      url: productUrl,
      siteName: "CLOTHING STORE",
      images: image ? [{ url: image, alt: p.images[0]?.alt || p.name }] : undefined,
      type: "website",
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: productName,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const price = effectivePrice(p);
  const related = await db.query.products.findMany({
    where: and(
      eq(products.active, true),
      ne(products.id, p.id),
      p.categoryId ? eq(products.categoryId, p.categoryId) : sql`true`
    ),
    limit: 4,
    with: { images: { orderBy: (t, { asc }) => [asc(t.sort)] }, variants: true, category: true },
  });

  const approvedReviews = await db
    .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, name: users.name })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(and(eq(reviews.productId, p.id), eq(reviews.approved, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  const relatedCards: CardProduct[] = related.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    image: r.images[0]?.url ?? null,
    price: r.price,
    salePrice: r.salePrice,
    category: r.category?.name ?? null,
    isNew: r.isNew,
    inStock: r.variants.some((v) => v.stock > 0),
  }));

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const productUrl = `${siteUrl}/product/${p.slug}`;
  const productName = p.name.replace(/\s+/g, " ").trim();
  const rawDescription = p.description.trim();
  const productDescription = rawDescription.length >= 40 ? rawDescription : `${productName} at CLOTHING STORE. ${rawDescription || "Explore product details and availability online."}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description: productDescription.slice(0, 5000),
    url: productUrl,
    brand: { "@type": "Brand", name: p.brand || "CLOTHING STORE" },
    category: p.category?.name,
    image: p.images.map((i) => new URL(i.url, siteUrl).toString()),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: price / 100,
      availability: p.variants.some((v) => v.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "CLOTHING STORE",
      },
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-fog">
        <Link href="/" className="transition hover:text-ivory">Home</Link>
        <span aria-hidden>/</span>
        <Link href="/shop" className="transition hover:text-ivory">Shop</Link>
        {p.category && (
          <>
            <span aria-hidden>/</span>
            <Link href={`/shop?category=${p.category.slug}`} className="transition hover:text-ivory">{p.category.name}</Link>
          </>
        )}
        <span aria-hidden>/</span>
        <span className="text-ivory">{p.name}</span>
      </nav>

      <ProductDetail
        product={{
          id: p.id,
          name: productName,
          slug: p.slug,
          description: p.description,
          brand: p.brand,
          price: p.price,
          salePrice: p.salePrice,
          category: p.category?.name ?? null,
          tags: p.tags,
        }}
        images={p.images.map((i) => ({ url: i.url, alt: i.alt || p.name }))}
        variants={p.variants.map((v) => ({ id: v.id, size: v.size, colorName: v.colorName, colorHex: v.colorHex, stock: v.stock }))}
        reviews={approvedReviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, name: r.name, createdAt: r.createdAt.toISOString() }))}
        priceFormatted={formatINR(price)}
      />

      {relatedCards.length > 0 && (
        <section className="mt-24" aria-labelledby="related-h">
          <Reveal>
            <h2 id="related-h" className="mb-8 text-2xl font-black tracking-tight sm:text-3xl">
              Pairs <span className="font-editorial italic font-normal text-fog">well with</span>
            </h2>
          </Reveal>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {relatedCards.map((c, i) => (
              <Reveal key={c.id} delay={i * 60}>
                <ProductCard p={c} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed exclude={p.slug} />
    </div>
  );
}
