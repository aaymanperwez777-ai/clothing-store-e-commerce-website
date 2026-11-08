"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart, QtyStepper } from "@/components/cart";
import { recordProductView } from "@/components/recent";
import { formatINR } from "@/lib/utils";

type Variant = { id: string; size: string; colorName: string; colorHex: string; stock: number };
type Review = { id: string; rating: number; comment: string; name: string; createdAt: string };

export function ProductDetail({
  product,
  images,
  variants,
  reviews,
}: {
  product: { id: string; name: string; slug: string; description: string; brand: string; price: number; salePrice: number | null; category: string | null; tags: string[] };
  images: { url: string; alt: string }[];
  variants: Variant[];
  reviews: Review[];
  priceFormatted: string;
}) {
  const [showSticky, setShowSticky] = useState(false);
  
  useEffect(() => {
    const el = document.getElementById("main-buy-area");
    if (!el) return;
    const ob = new IntersectionObserver(([e]) => {
      setShowSticky(e.boundingClientRect.top < 0 && !e.isIntersecting);
    }, { threshold: 0 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  const { add, setOpen } = useCart();
  const router = useRouter();

  const colors = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of variants) if (!map.has(v.colorName)) map.set(v.colorName, v.colorHex);
    return [...map.entries()].map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  const sizes = useMemo(() => {
    const order = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
    const uniq = [...new Set(variants.map((v) => v.size))];
    return uniq.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  }, [variants]);

  const initialColor = colors[0]?.name ?? "";
  const [color, setColor] = useState(initialColor);
  const [size, setSize] = useState(
    () => variants.find((v) => v.colorName === initialColor && v.stock > 0)?.size ?? ""
  );
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState("50% 50%");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<"" | "cart" | "buy">("");
  const [sizeGuide, setSizeGuide] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);
  const [wished, setWished] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const selected = variants.find((v) => v.size === size && v.colorName === color) ?? null;

  useEffect(() => {
    recordProductView({ slug: product.slug, name: product.name, price: product.price, salePrice: product.salePrice, image: images[0]?.url ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickColor(name: string) {
    setColor(name);
    setErr("");
    const current = variants.find((v) => v.colorName === name && v.size === size);
    if (!current || current.stock < 1) {
      const first = variants.find((v) => v.colorName === name && v.stock > 0);
      setSize(first?.size ?? "");
    }
  }

  async function addToCart(buyNow: boolean) {
    setErr("");
    if (!size || !selected) {
      setErr("Please select a size first.");
      return;
    }
    if (selected.stock < 1) {
      setErr("This variant is out of stock.");
      return;
    }
    if (qty > selected.stock) {
      setErr(`Only ${selected.stock} left in this variant.`);
      return;
    }
    setBusy(buyNow ? "buy" : "cart");
    const error = await add(selected.id, qty);
    setBusy("");
    if (error) {
      setErr(error);
      return;
    }
    if (buyNow) router.push("/checkout");
    else setOpen(true);
  }

  async function toggleWish() {
    if (wishBusy) return;
    setWishBusy(true);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id }),
    });
    if (res.status === 401) router.push("/account");
    else if (res.ok) setWished((await res.json()).wished);
    setWishBusy(false);
  }

  const off = product.salePrice != null && product.salePrice < product.price ? Math.round((1 - product.salePrice / product.price) * 100) : 0;
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
      {/* ---------- gallery ---------- */}
      <div>
        <div
          ref={imgRef}
          className="grain relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-[2.2rem] border border-white/[0.06] bg-black"
          onPointerEnter={() => setZoom(true)}
          onPointerLeave={() => setZoom(false)}
          onPointerMove={(e) => {
            const r = imgRef.current?.getBoundingClientRect();
            if (!r) return;
            setZoomPos(`${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}% ${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
          }}
        >
          {images[imgIdx] && (
            <Image
              key={images[imgIdx].url}
              src={images[imgIdx].url}
              alt={images[imgIdx].alt}
              fill
              priority
              sizes="(max-width:1024px) 100vw, 55vw"
              className="object-cover transition-transform duration-300 ease-out"
              style={{
                transform: zoom ? "scale(1.7)" : "scale(1)",
                transformOrigin: zoomPos,
              }}
            />
          )}
          {off > 0 && <span className="absolute left-5 top-5 rounded-full bg-acid px-4 py-1.5 text-xs font-bold text-acid-ink">SAVE {off}%</span>}
        </div>
        {images.length > 1 && (
          <div className="mt-4 flex gap-3" role="tablist" aria-label="Product images">
            {images.map((img, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === imgIdx}
                onClick={() => setImgIdx(i)}
                className={`relative h-20 w-16 overflow-hidden rounded-2xl border transition ${
                  i === imgIdx ? "border-acid" : "border-line opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={img.url} alt={`${img.alt} — view ${i + 1}`} fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- info ---------- */}
      <div className="flex flex-col lg:pl-10">
        <div className="flex items-center gap-4">
          <span className="h-px w-8 bg-acid/40" />
          {product.category && <p className="kicker !text-acid uppercase !tracking-[0.3em] !text-[10px]">{product.category}</p>}
        </div>
        
        <h1 className="mt-6 text-4xl font-black leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">{product.name}</h1>
        
        <div className="mt-8 flex items-end justify-between border-b border-white/[0.06] pb-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black tabular-nums text-white">{formatINR(product.salePrice ?? product.price)}</span>
              {off > 0 && <span className="text-sm font-medium text-fog/40 line-through tabular-nums">{formatINR(product.price)}</span>}
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fog/60">Tax Included · Free Nationwide Shipping</p>
          </div>
          
          <div className="hidden flex-col items-end text-right sm:flex">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-acid/80">Available Now</p>
             <p className="mt-1 text-[11px] font-bold text-white/40">Ships within 24h</p>
          </div>
        </div>

        {/* colours */}
        <div className="mt-7">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
            Colour — <span className="text-ivory">{color}</span>
          </p>
          <div className="flex gap-2.5">
            {colors.map((c) => {
              const colorStock = variants.filter((v) => v.colorName === c.name).reduce((s, v) => s + v.stock, 0);
              return (
                <button
                  key={c.name}
                  onClick={() => pickColor(c.name)}
                  aria-label={`Colour ${c.name}${colorStock === 0 ? " (sold out)" : ""}`}
                  aria-pressed={color === c.name}
                  className={`relative grid size-11 place-items-center rounded-full border-2 transition ${
                    color === c.name ? "border-acid" : "border-line hover:border-white/30"
                  }`}
                >
                  <span className="size-7 rounded-full border border-white/10" style={{ background: c.hex }} />
                  {colorStock === 0 && <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rotate-45 bg-danger/80" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* sizes */}
        <div className="mt-6">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Select size</p>
            <button onClick={() => setSizeGuide(true)} className="text-xs text-fog underline underline-offset-4 transition hover:text-ivory">
              Size guide
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sizes">
            {sizes.map((s) => {
              const v = variants.find((x) => x.size === s && x.colorName === color);
              const soldOut = !v || v.stock < 1;
              return (
                <button
                  key={s}
                  disabled={soldOut}
                  onClick={() => { setSize(s); setErr(""); }}
                  aria-pressed={size === s}
                  className={`min-w-14 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    size === s
                      ? "border-acid bg-acid text-acid-ink"
                      : soldOut
                        ? "border-line text-fog/40 line-through"
                        : "border-line text-silver hover:border-white/35"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {selected && selected.stock > 0 && selected.stock <= 4 && (
            <p className="mt-2.5 text-xs font-semibold text-acid">Hurry — only {selected.stock} left in stock</p>
          )}
          {totalStock === 0 && <p className="mt-2.5 text-sm font-semibold text-danger">This piece is currently sold out.</p>}
        </div>

        {/* qty + actions */}
        <div className="mt-7 flex flex-wrap items-center gap-3" id="main-buy-area">
          <QtyStepper qty={qty} max={selected ? Math.min(10, selected.stock) : 10} onChange={setQty} />
          <button onClick={() => addToCart(false)} disabled={busy !== "" || totalStock === 0} className="btn btn-ghost flex-1 !py-3.5">
            {busy === "cart" ? "Adding…" : "Add to cart"}
          </button>
          <button onClick={() => addToCart(true)} disabled={busy !== "" || totalStock === 0} className="btn btn-acid flex-1 !py-3.5">
            {busy === "buy" ? "Working…" : "Buy now"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            onClick={toggleWish}
            aria-pressed={wished}
            aria-label="Toggle wishlist"
            className={`grid size-12 place-items-center rounded-full border transition ${wished ? "border-acid bg-acid text-acid-ink" : "border-line text-ivory hover:bg-white/[0.06]"}`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"}>
              <path d="M12 20.5c-5.2-3.1-8.5-6.2-8.5-10A4.6 4.6 0 0 1 8.1 5.9c1.6 0 3 .8 3.9 2a4.8 4.8 0 0 1 3.9-2 4.6 4.6 0 0 1 4.6 4.6c0 3.8-3.3 6.9-8.5 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {err && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{err}</p>}

        {/* delivery */}
        <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-3xl border border-line bg-white/[0.02] p-4">
            <p className="font-bold">Free shipping</p>
            <p className="mt-1 text-xs leading-relaxed text-fog">On orders above ₹1,499 · 3–6 business days across India</p>
          </div>
          <div className="rounded-3xl border border-line bg-white/[0.02] p-4">
            <p className="font-bold">COD available</p>
            <p className="mt-1 text-xs leading-relaxed text-fog">Pay cash or UPI on delivery · Easy 7-day size exchanges</p>
          </div>
        </div>

        {/* description */}
        <div className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-fog">Details</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-silver">{product.description || "Product details coming soon."}</p>
          {product.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.tags.map((t) => (
                <span key={t} className="chip !cursor-default !py-1.5 !text-[11px]">#{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* reviews */}
        <section className="mt-10" aria-labelledby="reviews-h">
          <h2 id="reviews-h" className="text-sm font-bold uppercase tracking-[0.16em] text-fog">
            Reviews {reviews.length > 0 && `(${reviews.length})`}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {reviews.length === 0 && <p className="text-sm text-fog">No reviews yet — be the first after your order arrives.</p>}
            {reviews.map((r) => (
              <article key={r.id} className="rounded-3xl border border-line bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{r.name}</p>
                  <div className="flex gap-0.5 text-acid" aria-label={`${r.rating} of 5`}>
                    {Array.from({ length: 5 }).map((_, s) => (
                      <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s < r.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" strokeLinejoin="round"/></svg>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-silver">{r.comment}</p>
              </article>
            ))}
          </div>
          <ReviewForm productId={product.id} />
        </section>
      </div>

      {/* ---------- sticky buy bar ---------- */}
      <div 
        className={`fixed top-0 inset-x-0 z-[55] flex h-[4.5rem] items-center justify-between border-b border-white/10 bg-black/80 px-4 backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] sm:px-6 ${
          showSticky ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="relative size-10 overflow-hidden rounded-xl border border-white/10 bg-[#050505] hidden sm:block">
            {images[0] && <Image src={images[0].url} alt={product.name} fill sizes="40px" className="object-cover" unoptimized={images[0].url.startsWith("/uploads/")} />}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">{product.name}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog/60">{formatINR(product.salePrice ?? product.price)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => {
             document.getElementById("main-buy-area")?.scrollIntoView({ behavior: "smooth", block: "center" });
           }} className="btn btn-acid !py-2.5 !px-6 !text-xs whitespace-nowrap">
             Select Size
           </button>
        </div>
      </div>

      {/* ---------- size guide dialog ---------- */}
      {sizeGuide && (
        <div className="fixed inset-0 z-[90] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Size guide">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSizeGuide(false)} />
          <div className="glass relative w-full max-w-md rounded-[2rem] bg-black/95 p-8">
            <button onClick={() => setSizeGuide(false)} aria-label="Close size guide" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-line text-fog hover:text-ivory">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
            <h3 className="text-xl font-black">Size guide</h3>
            <p className="mt-1 text-xs text-fog">All pieces are oversized unisex fits — size down for a regular fit.</p>
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fog">
                  <th className="pb-2">Size</th><th className="pb-2">Chest (in)</th><th className="pb-2">Length (in)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-silver">
                {[["XS", "38", "26"], ["S", "40", "27"], ["M", "42", "28"], ["L", "44", "29"], ["XL", "46", "30"], ["XXL", "48", "31"]].map((r) => (
                  <tr key={r[0]} className="border-t border-line">
                    <td className="py-2.5 font-bold">{r[0]}</td><td className="py-2.5">{r[1]}</td><td className="py-2.5">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ loading: boolean; msg: string; err: boolean }>({ loading: false, msg: "", err: false });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ loading: true, msg: "", err: false });
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, rating: Number(fd.get("rating")), comment: String(fd.get("comment") ?? "") }),
    });
    const data = await res.json();
    if (res.ok) {
      setState({ loading: false, msg: data.message, err: false });
      setOpen(false);
    } else {
      setState({ loading: false, msg: data.error ?? "Failed.", err: true });
    }
  }

  if (!open) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <button onClick={() => setOpen(true)} className="btn btn-ghost w-fit !py-2.5 !text-[13px]">Write a review</button>
        {state.msg && <p className={`text-sm ${state.err ? "text-danger" : "text-acid"}`}>{state.msg}</p>}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 rounded-3xl border border-line bg-white/[0.02] p-5">
      <div className="flex items-center gap-3">
        <label htmlFor="rv-rating" className="text-sm font-semibold">Rating</label>
        <select id="rv-rating" name="rating" defaultValue="5" className="input !w-auto !py-2 !text-sm">
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      </div>
      <label htmlFor="rv-comment" className="sr-only">Your review</label>
      <textarea id="rv-comment" name="comment" required minLength={3} maxLength={600} rows={3} placeholder="How's the fit, fabric, vibe?" className="input resize-none" />
      <div className="flex gap-2">
        <button type="submit" disabled={state.loading} className="btn btn-acid !py-2.5 !text-[13px]">{state.loading ? "Sending…" : "Submit review"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost !py-2.5 !text-[13px]">Cancel</button>
      </div>
      {state.msg && <p className={`text-sm ${state.err ? "text-danger" : "text-acid"}`}>{state.msg}</p>}
    </form>
  );
}
