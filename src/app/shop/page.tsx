import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/db";
import { products, productVariants, categories } from "@/db/schema";
import { desc, asc, eq, sql, and, SQL } from "drizzle-orm";
import { ProductCard, type CardProduct } from "@/components/product-card";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = {
  title: "Shop All — Premium Unisex Streetwear",
  description: "Browse the full CLOTHING STORE catalogue: oversized tees, hoodies, cargos, jackets and accessories. Filters by size, colour and price.",
  alternates: { canonical: "/shop" },
};

export const dynamic = "force-dynamic";
const PER_PAGE = 12;

type SP = Record<string, string | string[] | undefined>;

function param(sp: SP, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = param(sp, "q").trim();
  const category = param(sp, "category").trim();
  const size = param(sp, "size").trim();
  const color = param(sp, "color").trim();
  const min = Math.max(0, parseInt(param(sp, "min")) || 0);
  const max = Math.max(0, parseInt(param(sp, "max")) || 0);
  const sort = param(sp, "sort") || "new";
  const page = Math.max(1, parseInt(param(sp, "page")) || 1);
  const focusSearch = param(sp, "focus") === "search";

  const conds: SQL[] = [eq(products.active, true)];
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    conds.push(sql`(lower(${products.name}) LIKE ${like} OR lower(${products.description}) LIKE ${like})`);
  }
  if (category) {
    conds.push(sql`${products.categoryId} = (SELECT id FROM categories WHERE slug = ${category} LIMIT 1)`);
  }
  if (size) {
    conds.push(sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND v.size = ${size.toUpperCase()} AND v.stock > 0)`);
  }
  if (color) {
    conds.push(sql`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = ${products.id} AND lower(v.color_name) = lower(${color}))`);
  }
  if (min > 0) conds.push(sql`COALESCE(${products.salePrice}, ${products.price}) >= ${min * 100}`);
  if (max > 0) conds.push(sql`COALESCE(${products.salePrice}, ${products.price}) <= ${max * 100}`);

  const orderBy =
    sort === "price-asc"
      ? asc(sql`COALESCE(${products.salePrice}, ${products.price})`)
      : sort === "price-desc"
        ? desc(sql`COALESCE(${products.salePrice}, ${products.price})`)
        : sort === "featured"
          ? desc(products.featured)
          : desc(products.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(...conds));

  const rows = await db.query.products.findMany({
    where: and(...conds),
    orderBy: [orderBy, desc(products.createdAt)],
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
    with: {
      images: { orderBy: (t, { asc: a }) => [a(t.sort)] },
      variants: true,
      category: true,
    },
  });

  const [cats, sizeRows, colorRows] = await Promise.all([
    db.select().from(categories).orderBy(categories.sort),
    db.selectDistinct({ size: productVariants.size }).from(productVariants),
    db.selectDistinct({ color: productVariants.colorName }).from(productVariants),
  ]);
  const sizes = sizeRows.map((r) => r.size).sort((a, b) => {
    const order = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });
  const colors = colorRows.map((r) => r.color);

  const buildUrl = (patch: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = { q, category, size, color, min: String(min || ""), max: String(max || ""), sort };
    for (const [k, v] of Object.entries(patch)) merged[k] = String(v);
    for (const [k, v] of Object.entries(merged)) if (v && v !== "0") params.set(k, v);
    if (Number(merged.page ?? 1) > 1) params.set("page", merged.page);
    else params.delete("page");
    return `/shop?${params.toString()}`;
  };

  const cards: CardProduct[] = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images[0]?.url ?? null,
    price: p.price,
    salePrice: p.salePrice,
    category: p.category?.name ?? null,
    isNew: p.isNew,
    inStock: p.variants.some((v) => v.stock > 0),
  }));

  const totalPages = Math.max(1, Math.ceil(Number(count) / PER_PAGE));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6">
      <Reveal>
        <p className="kicker">The catalogue</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          Shop <span className="font-editorial italic font-normal text-fog">everything</span>
        </h1>
        <p className="mt-3 text-sm text-fog">{Number(count)} product{Number(count) === 1 ? "" : "s"}</p>
      </Reveal>

      {/* search & category bento */}
      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_auto]">
        <form method="get" action="/shop" role="search" className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-fog/60 group-focus-within:text-acid transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" strokeLinecap="round"/></svg>
          </div>
          <input
            id="shop-q"
            name="q"
            defaultValue={q}
            autoFocus={focusSearch}
            placeholder="Explore the collection..."
            className="w-full bg-black border border-white/[0.06] rounded-full py-4.5 pl-14 pr-32 text-lg font-medium tracking-tight outline-none focus:border-white/30 focus:ring-4 focus:ring-white/5 transition-all"
          />
          <button type="submit" className="absolute right-2 top-1.5 bottom-1.5 btn btn-acid !px-8 !text-xs font-black uppercase tracking-widest">Search</button>
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
        </form>

        <div className="no-scrollbar flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Categories">
          <Link href={buildUrl({ category: "", page: 1 })} className="chip !px-8 !py-4.5 !text-xs font-black uppercase tracking-widest" data-active={!category}>All</Link>
          {cats.map((c) => (
            <Link key={c.id} href={buildUrl({ category: c.slug, page: 1 })} className="chip !px-8 !py-4.5 !text-xs font-black uppercase tracking-widest" data-active={category === c.slug}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* filters */}
      <form method="get" action="/shop" className="surface-card mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 !rounded-[1.75rem] px-6 py-5">
        {q && <input type="hidden" name="q" value={q} />}
        {category && <input type="hidden" name="category" value={category} />}
        <div>
          <label htmlFor="f-size" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Size</label>
          <select id="f-size" name="size" defaultValue={size} className="input !w-auto !py-2.5 !text-sm">
            <option value="">Any</option>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-color" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Colour</label>
          <select id="f-color" name="color" defaultValue={color} className="input !w-auto !py-2.5 !text-sm">
            <option value="">Any</option>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-min" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Min ₹</label>
          <input id="f-min" name="min" type="number" min={0} defaultValue={min || ""} placeholder="0" className="input !w-24 !py-2.5 !text-sm" />
        </div>
        <div>
          <label htmlFor="f-max" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Max ₹</label>
          <input id="f-max" name="max" type="number" min={0} defaultValue={max || ""} placeholder="5000" className="input !w-24 !py-2.5 !text-sm" />
        </div>
        <div>
          <label htmlFor="f-sort" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Sort</label>
          <select id="f-sort" name="sort" defaultValue={sort} className="input !w-auto !py-2.5 !text-sm">
            <option value="new">Newest</option>
            <option value="featured">Best sellers</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-acid !py-2.5 !text-[13px]">Apply filters</button>
          <Link href="/shop" className="btn btn-ghost !py-2.5 !text-[13px]">Clear</Link>
        </div>
      </form>

      {/* grid */}
      {cards.length === 0 ? (
        <div className="surface-card mt-10 grid place-items-center rounded-[2rem] py-24 text-center">
          <p className="text-lg font-bold">Nothing matches those filters</p>
          <p className="mt-2 text-sm text-fog">Try widening your search or clearing filters.</p>
          <Link href="/shop" className="btn btn-ghost mt-6">Clear all filters</Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {cards.map((p, i) => (
            <Reveal key={p.id} delay={(i % 8) * 80}>
              <ProductCard p={p} priority={i < 4} />
            </Reveal>
          ))}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={buildUrl({ page: page - 1 })} className="chip" aria-label="Previous page">← Prev</Link>
          )}
          {Array.from({ length: totalPages }).map((_, i) => (
            <Link
              key={i}
              href={buildUrl({ page: i + 1 })}
              className="chip"
              data-active={page === i + 1}
              aria-current={page === i + 1 ? "page" : undefined}
            >
              {i + 1}
            </Link>
          ))}
          {page < totalPages && (
            <Link href={buildUrl({ page: page + 1 })} className="chip" aria-label="Next page">Next →</Link>
          )}
        </nav>
      )}
    </div>
  );
}
