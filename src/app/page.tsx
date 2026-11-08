import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { db } from "@/db";
import { products, categories, reviews, users } from "@/db/schema";
import { desc, eq, and, asc } from "drizzle-orm";
import {
  getSetting,
  getSettingRaw,
  DEFAULT_HERO,
  DEFAULT_PROMO,
  DEFAULT_SOCIAL,
  DEFAULT_TESTIMONIALS,
  type HeroSettings,
  type PromoSettings,
  type SocialSettings,
  type Testimonial,
} from "@/lib/settings";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { Reveal, Parallax, Magnetic, FloatingShapes, Tilt } from "@/components/motion";
import { TopographicBackground } from "@/components/topographic-bg";
import { NewsletterForm } from "@/components/home-client";
import { RingCarousel, type RingProduct } from "@/components/ring-carousel";
import { DEFAULT_HOMEPAGE_SECTIONS, type HomepageSections } from "@/lib/homepage-sections";

export const metadata: Metadata = {
  title: "Oversized Streetwear & Everyday Clothing",
  description:
    "Explore oversized fits, heavyweight cotton T-shirts and unisex everyday streetwear at CLOTHING STORE.",
  alternates: {
    canonical: "/",
  },
};
export const dynamic = "force-dynamic";

type ProductRow = {
  id: string; slug: string; name: string; price: number; salePrice: number | null;
  isNew: boolean; featured: boolean;
  category: { name: string; slug?: string } | null;
  images: { url: string }[];
  variants: { stock: number; size: string }[];
};

function toCard(p: ProductRow): CardProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images[0]?.url ?? null,
    price: p.price,
    salePrice: p.salePrice,
    category: p.category?.name ?? null,
    isNew: p.isNew,
    inStock: p.variants.some((v) => v.stock > 0),
  };
}

const MARQUEE = ["OVERSIZED FITS", "HEAVYWEIGHT FABRIC", "UNISEX", "LIMITED RUNS", "MADE IN INDIA", "FREE SHIPPING ₹1,499+", "COD AVAILABLE"];
export default async function HomePage() {
  const [hero, promo, social, testimonials, homepageSections, cats, approvedReviews, allProducts] = await Promise.all([
    getSetting<HeroSettings>("hero", DEFAULT_HERO),
    getSetting<PromoSettings>("promo", DEFAULT_PROMO),
    getSetting<SocialSettings>("social", DEFAULT_SOCIAL),
    getSettingRaw<Testimonial[]>("testimonials", DEFAULT_TESTIMONIALS),
    getSetting<HomepageSections>("homepage_sections", DEFAULT_HOMEPAGE_SECTIONS),
    db.select().from(categories).orderBy(categories.sort),
    db
      .select({ rating: reviews.rating, comment: reviews.comment, name: users.name })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.approved, true))
      .orderBy(desc(reviews.createdAt))
      .limit(3),
    db.query.products.findMany({
      where: eq(products.active, true),
      orderBy: [desc(products.createdAt)],
      with: { images: { orderBy: (t, { asc }) => [asc(t.sort)] }, variants: true, category: true },
    }),
  ]);

  const all = allProducts as unknown as ProductRow[];
  const newArrivals = all.filter((p) => p.isNew).slice(0, 8);
  const bestSellers = all.filter((p) => p.featured).slice(0, 6);
  const onSale = all.filter((p) => p.salePrice != null && p.salePrice < p.price).slice(0, 6);

  // Group products by category
  const productsByCategory = new Map<string, { cat: typeof cats[0]; items: ProductRow[] }>();
  for (const c of cats) {
    const items = all.filter((p) => p.category?.name === c.name);
    if (items.length > 0) productsByCategory.set(c.id, { cat: c, items });
  }
  // Uncategorised products
  const uncategorised = all.filter((p) => !p.category);

  const instaImages = social.instagramImages.slice(0, 6);

  // â”€â”€ build ring carousel items from real DB products â”€â”€â”€â”€â”€â”€
  const ringItems: RingProduct[] = all
    .filter(p => p.images.length > 0)
    .slice(0, 6)
    .map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      salePrice: p.salePrice,
      img: p.images[0].url,
      category: p.category?.name ?? "Collection",
    }));

  return (
    <div className="relative">
      {/* ================= HERO ================= */}
      {homepageSections.hero && (
        <div className="grain relative mx-auto min-h-[85vh] max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/[0.06] sm:rounded-[2.75rem]">
          <TopographicBackground />
          <FloatingShapes />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          <div className="relative flex min-h-[85vh] flex-col justify-end p-6 pb-10 sm:p-12 lg:p-16">
            <Reveal>
              <h1 className="max-w-5xl text-[14vw] font-black leading-[0.82] tracking-[-0.05em] sm:text-8xl lg:text-[8rem]">
                {hero.title}
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-silver/80 sm:text-lg">{hero.subtitle}</p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
                <Magnetic>
                  <Link href="/shop?sort=new" className="btn btn-acid !px-7 !py-3.5 !text-[14px] sm:!px-8 sm:!text-[15px]">
                    {hero.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </Magnetic>
                <Magnetic>
                  <Link href="#collections" className="btn btn-ghost glass !px-7 !py-3.5 !text-[14px] sm:!px-8 sm:!text-[15px]">
                    Explore collections
                  </Link>
                </Magnetic>
              </div>
            </Reveal>
          </div>
        </div>

      )}
      {homepageSections.carousel && (
        <RingCarousel items={ringItems} />

      )}
      {homepageSections.marquee && (
        <div className="w-full max-w-full overflow-hidden">
          <div className="flex w-max animate-marquee gap-16 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="flex items-center gap-16 text-[11px] font-black uppercase tracking-[0.4em] text-white/30 transition-colors hover:text-white">
              {m}
              <span className="text-white/20">✦</span>
            </span>
          ))}
        
          </div>
        </div>

      )}
      {homepageSections.categoryNav && (
        <Reveal>
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Shop by category</p>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {cats.map((c) => (
                <Link key={c.id} href={`#cat-${c.slug}`} className="chip !px-6 !py-3 !text-xs font-black uppercase tracking-wider whitespace-nowrap">
                  {c.name}
                </Link>
              ))}
              <Link href="/shop" className="chip !px-6 !py-3 !text-xs font-black uppercase tracking-wider whitespace-nowrap" data-active>
                View all
              </Link>
            </div>
          </div>
        </Reveal>

      )}
      {homepageSections.promo && promo.enabled && (
        <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
          <Reveal>
            <Link
              href={promo.href}
              className="group flex flex-wrap items-center justify-between gap-4 rounded-[2.5rem] border border-white/[0.08] bg-black px-8 py-7 transition-all duration-500 hover:border-white/20 hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] sm:px-12"
            >
              <div className="flex items-center gap-4">
                <span className="grid size-10 place-items-center rounded-full bg-white text-black text-xs font-black">NEW</span>
                <p className="text-[15px] font-semibold text-white/80">{promo.text}</p>
              </div>
              <span className="btn btn-ghost !py-2.5 !text-[12px] font-black uppercase tracking-widest group-hover:bg-white/10">{promo.cta}</span>
            </Link>
          </Reveal>
        </section>
      )}

      {/* ================= NEW ARRIVALS ================= */}
      {homepageSections.newArrivals && (
        <>
        <Reveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="new-arrivals" className="text-3xl font-black tracking-tight sm:text-4xl">
              New <span className="font-editorial italic font-normal text-fog/60 lowercase">arrivals</span>
            </h2>
            <Link href="/shop?sort=new" className="chip">View all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </Reveal>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {newArrivals.map((p, i) => (
            <div key={p.id} className="w-[70vw] max-w-[290px] shrink-0 snap-start">
              <Reveal delay={i * 60} className="h-full">
                <ProductCard p={toCard(p)} priority={i < 3} />
              </Reveal>
            </div>
          ))}
        </div>
        </>

      )}
      {homepageSections.bestSellers && (
        <>
        <Reveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="best-sellers" className="text-3xl font-black tracking-tight sm:text-4xl">
              Best <span className="font-editorial italic font-normal text-fog/60 lowercase">sellers</span>
            </h2>
            <Link href="/shop?sort=featured" className="chip">Shop all
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {bestSellers.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}>
              <ProductCard p={toCard(p)} />
            </Reveal>
          ))}
        </div>
        </>

      )}
      {homepageSections.onSale && onSale.length > 0 && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="on-sale">
          <Reveal>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="kicker mb-2">Limited time</p>
                <h2 id="on-sale" className="text-3xl font-black tracking-tight sm:text-4xl">
                  On <span className="font-editorial italic font-normal text-fog/60 lowercase">sale</span>
                </h2>
              </div>
              <Link href="/shop?sort=price-asc" className="chip">View all deals
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {onSale.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 70}>
                <ProductCard p={toCard(p)} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ================= TRUST USP STRIP ================= */}
      {homepageSections.benefits && (
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: "🚚", title: "Free Shipping", desc: "On orders above ₹1,499 across India" },
              { icon: "💰", title: "Cash on Delivery", desc: "Pay when your order arrives at your door" },
              { icon: "🔄", title: "7-Day Easy Exchange", desc: "Size not right? We've got you covered" },
              { icon: "✨", title: "Premium Quality", desc: "300+ GSM heavyweight cotton, bio-washed" },
            ].map((usp) => (
              <div key={usp.title} className="surface-card flex items-start gap-4 !rounded-[1.5rem] p-6">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/[0.04] text-xl">{usp.icon}</span>
                <div>
                  <p className="text-sm font-bold">{usp.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-fog">{usp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      )}
      {/* ================= SHOP BY CATEGORY â€” CURATED GRIDS ================= */}
      {homepageSections.categoryGrids && [...productsByCategory.values()].map(({ cat, items }) => {
        const show = items.slice(0, 6);
        const hasMore = items.length > 6;
        return (
          <section key={cat.id} id={`cat-${cat.slug}`} className="mx-auto mt-28 max-w-7xl scroll-mt-28 px-4 sm:px-6" aria-labelledby={`cat-h-${cat.id}`}>
            <Reveal>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 id={`cat-h-${cat.id}`} className="text-3xl font-black tracking-tight sm:text-4xl">
                    {cat.name.split(" ")[0]}{" "}
                    <span className="font-editorial italic font-normal text-fog/60 lowercase">
                      {cat.name.split(" ").slice(1).join(" ") || "collection"}
                    </span>
                  </h2>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-bold tabular-nums text-fog">{items.length}</span>
                </div>
                <Link href={`/shop?category=${cat.slug}`} className="chip">View all {items.length}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              </div>
            </Reveal>
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
              {show.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 60}>
                  <ProductCard p={toCard(p)} />
                </Reveal>
              ))}
            </div>
            {hasMore && (
              <Reveal>
                <div className="mt-8 text-center">
                  <Link href={`/shop?category=${cat.slug}`} className="btn btn-ghost !px-10 !py-3.5 !text-sm">
                    See all {items.length} {cat.name.toLowerCase()}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </div>
              </Reveal>
            )}
          </section>
        );
      })}

      {/* Uncategorised products */}
      {homepageSections.uncategorised && uncategorised.length > 0 && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="uncategorised-h">
          <Reveal>
            <div className="mb-8">
              <h2 id="uncategorised-h" className="text-3xl font-black tracking-tight sm:text-4xl">
                More <span className="font-editorial italic font-normal text-fog/60 lowercase">drops</span>
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-3">
            {uncategorised.slice(0, 6).map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 40}>
                <ProductCard p={toCard(p)} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ================= COLLECTIONS BENTO ================= */}
      {homepageSections.collections && (
        <>
        <Reveal>
          <div className="mb-12 flex flex-col items-center text-center">
            <p className="kicker mb-3">Curated Drops</p>
            <h2 id="collections-h" className="text-4xl font-black tracking-tighter sm:text-6xl">
              Signature <span className="font-editorial italic font-normal text-fog/60 lowercase">lines</span>
            </h2>
          </div>
        </Reveal>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {cats.map((c, i) => {
            const gridClasses = [
              "lg:col-span-2 lg:row-span-2",
              "lg:col-span-2 lg:row-span-1",
              "lg:col-span-1 lg:row-span-1",
              "lg:col-span-1 lg:row-span-1",
              "lg:col-span-2 lg:row-span-1",
            ][i] || "";

            return (
              <Reveal key={c.id} delay={i * 100} className={gridClasses}>
                <Link
                  href={`/shop?category=${c.slug}`}
                  className="group relative block h-full min-h-[300px] overflow-hidden rounded-[2.5rem] border border-white/[0.04] bg-black transition-all duration-700 hover:border-white/15 hover:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] hover:-translate-y-1"
                >
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={`${c.name} collection`}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-1000 ease-[cubic-bezier(0.2,1,0.3,1)] group-hover:scale-110 group-hover:rotate-1"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
                  
                  <div className="absolute inset-0 flex flex-col justify-end p-8 sm:p-10">
                    <span className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 opacity-0 transition-all duration-500 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0">Explore Drop</span>
                    <h3 className="font-editorial text-3xl italic leading-none tracking-tight text-white sm:text-4xl lowercase">{c.name}</h3>
                    <div className="mt-4 flex h-0 items-center justify-between overflow-hidden transition-all duration-500 group-hover:h-12 group-hover:mt-6">
                      <p className="max-w-[200px] text-xs leading-relaxed text-fog">{c.description || "Limited edition unisex silhouettes."}</p>
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-black transition-transform duration-500 group-hover:rotate-[360deg]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17 17 7M9 7h8v8"/></svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
        </>

      )}
      {homepageSections.story && (
        <div className="relative overflow-hidden rounded-[3rem] border border-white/[0.04] bg-black">
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[400px] overflow-hidden lg:min-h-[600px]">
              {instaImages[0] && (
                <Parallax speed={0.05} className="absolute inset-0">
                  <Image 
                    src={instaImages[0].url} 
                    alt="Behind the scenes" 
                    fill 
                    sizes="(max-width:1024px) 100vw, 50vw" 
                    className="scale-110 object-cover grayscale transition-all duration-1000 group-hover:grayscale-0" 
                  />
                </Parallax>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black" />
              <div className="absolute inset-0 bg-black/40 mix-blend-overlay" />
            </div>
            
            <div className="relative flex flex-col justify-center gap-8 p-10 sm:p-16 lg:p-20">
              <Reveal>
                <div className="inline-flex items-center gap-3">
                  <span className="h-px w-10 bg-white" />
                  <p className="kicker !text-white !not-italic !font-bold !tracking-[0.4em] !text-[10px] uppercase">The Manifesto</p>
                </div>
                <h2 id="story-h" className="mt-6 text-4xl font-black leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
                  Born on <span className="font-editorial italic font-normal lowercase text-white/50">the streets.</span><br />
                  Worn by <span className="text-white underline underline-offset-8 decoration-1 decoration-white/20">the bold.</span>
                </h2>
              </Reveal>
              
              <Reveal delay={100}>
                <p className="max-w-md text-lg leading-relaxed text-silver/70">
                  CLOTHING STORE is more than a label. It&apos;s a rejection of the ordinary. 
                  We craft oversized silhouettes for those who find comfort in the unconventional. 
                  Everyday styles, carefully selected collections, and clothing for every occasion.
                </p>
              </Reveal>
              
              <Reveal delay={200}>
                <div className="flex flex-wrap gap-12 pt-4">
                  {[["100%", "Unisex"], ["300+", "GSM"], ["âˆž", "Attitude"]].map(([v, l]) => (
                    <div key={l} className="group">
                      <p className="text-3xl font-black tracking-tighter text-white transition-colors group-hover:text-white/60">{v}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.3em] text-fog/50">{l}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              
              <Reveal delay={300}>
                <Magnetic>
                  <Link href="/shop" className="btn btn-ghost glass group !px-10 !py-4 !text-sm">
                    Shop the collection
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-1"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.5"/></svg>
                  </Link>
                </Magnetic>
              </Reveal>
            </div>
          </div>
        </div>

      )}
      {homepageSections.instagram && (
        <>
        <Reveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker mb-2 lowercase">On the feed</p>
              <h2 id="insta-h" className="text-3xl font-black tracking-tight sm:text-4xl lowercase">Our Instagram</h2>
            </div>
            <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="chip">
              Follow on Instagram
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {instaImages.map((img, i) => (
            <Reveal key={i} delay={i * 50}>
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="group relative block aspect-square overflow-hidden rounded-[1.6rem] border border-line">
                <Image src={img.url} alt={img.alt} fill sizes="(max-width: 640px) 50vw, 16vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute inset-0 bg-white/0 transition-colors duration-500 group-hover:bg-white/5" />
              </a>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-xs text-fog">
          Imagery shown with reference to our official Instagram. Product availability may vary â€” check the shop for live stock.
        </p>
        </>

      )}
      {homepageSections.testimonials && (testimonials.length > 0 || approvedReviews.length > 0) && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6" aria-labelledby="voices-h">
          <Reveal>
            <h2 id="voices-h" className="mb-8 text-3xl font-black tracking-tight sm:text-4xl">
              Community <span className="font-editorial italic font-normal text-fog/60 lowercase">voices</span>
            </h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.slice(0, 3).map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure className="surface-card flex h-full flex-col p-7">
                  <div className="flex gap-1 text-white/50" aria-label={`${t.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, s) => (
                      <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s < t.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
                        <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" strokeLinejoin="round" />
                      </svg>
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-silver">â€œ{t.quote}â€</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-bold">{t.name}</span>
                    <span className="text-fog"> · {t.location}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
            {testimonials.length === 0 &&
              approvedReviews.map((r, i) => (
                <Reveal key={i} delay={i * 80}>
                  <figure className="surface-card flex h-full flex-col p-7">
                    <blockquote className="flex-1 text-[15px] leading-relaxed text-silver">â€œ{r.comment}â€</blockquote>
                    <figcaption className="mt-5 text-sm font-bold">{r.name}</figcaption>
                  </figure>
                </Reveal>
              ))}
          </div>
        </section>
      )}

      {/* ================= NEWSLETTER ================= */}
      {homepageSections.newsletter && (
      <section className="mx-auto mt-36 max-w-7xl px-4 sm:px-6" aria-labelledby="nl-h">
        <Reveal>
          <div className="relative overflow-hidden rounded-[3rem] border border-white/[0.06] bg-black px-7 py-20 text-center sm:px-16">
            {/* 3D depth rings */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="size-[600px] rounded-full border border-white/[0.03] animate-spin-slower" />
            </div>
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="size-[400px] rounded-full border border-white/[0.04]" style={{ animation: "spin 28s linear infinite reverse" }} />
            </div>
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="size-3 rounded-full bg-white/20 animate-pulse-soft" />
            </div>

            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 lowercase">The Inner Circle</p>
              <h2 id="nl-h" className="mx-auto mt-5 max-w-xl text-4xl font-black tracking-tighter sm:text-6xl">
                Drops sell out fast.<br /><span className="font-editorial italic font-normal text-white/50 lowercase">Be first.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-white/30">
                Early access, secret sales and zero spam. One email per drop, that&apos;s the deal.
              </p>
              <div className="mx-auto mt-10 max-w-md">
                <NewsletterForm />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      )}
      <div className="h-28" />
    </div>
  );
}










