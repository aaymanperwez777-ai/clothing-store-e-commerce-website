"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tilt } from "@/components/motion";
import { formatINR } from "@/lib/utils";

export type CardProduct = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
  salePrice: number | null;
  category?: string | null;
  isNew?: boolean;
  inStock: boolean;
};

export function ProductCard({ p, priority = false }: { p: CardProduct; priority?: boolean }) {
  const [wished, setWished] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);
  const router = useRouter();
  const off = p.salePrice != null && p.salePrice < p.price ? Math.round((1 - p.salePrice / p.price) * 100) : 0;

  async function toggleWish(e: React.MouseEvent) {
    e.preventDefault();
    if (wishBusy) return;
    setWishBusy(true);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: p.id }),
    });
    if (res.status === 401) {
      router.push("/account?next=/shop");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setWished(data.wished);
    }
    setWishBusy(false);
  }

  return (
    <Tilt max={5} className="group h-full">
      <Link
        href={`/product/${p.slug}`}
        className="relative flex h-full flex-col overflow-hidden rounded-[2.2rem] border border-white/[0.05] bg-black transition-all duration-500 group-hover:border-white/15 group-hover:shadow-premium"
      >
        {/* Sculpted Image Container */}
        <div className="relative m-2 overflow-hidden rounded-[1.8rem] bg-[#050505] aspect-[4/5]">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          
          {p.image ? (
            <Image
              src={p.image}
              alt={p.name}
              fill
              sizes="(max-width: 640px) 70vw, (max-width: 1024px) 33vw, 23vw"
              priority={priority}
              className="object-cover transition-transform duration-1000 cubic-bezier(0.2, 1, 0.3, 1) group-hover:scale-110"
              unoptimized={p.image.startsWith("/uploads/")}
            />
          ) : (
            <div className="grid h-full place-items-center text-[10px] uppercase tracking-widest text-fog">Missing Visual</div>
          )}

          {/* Floating Accents */}
          <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              {off > 0 && (
                <span className="rounded-full bg-acid px-2.5 py-1 text-[10px] font-black uppercase text-acid-ink shadow-lg">-{off}%</span>
              )}
              {p.isNew && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-black shadow-lg">New</span>
              )}
            </div>
            
            <button
              onClick={toggleWish}
              className={`grid size-9 place-items-center rounded-full border border-white/10 backdrop-blur-md transition-all duration-300 ${
                wished
                  ? "bg-acid text-acid-ink border-acid scale-110"
                  : "bg-black/20 text-white hover:bg-white hover:text-black"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={wished ? "currentColor" : "none"}>
                <path d="M12 20.5c-5.2-3.1-8.5-6.2-8.5-10A4.6 4.6 0 0 1 8.1 5.9c1.6 0 3 .8 3.9 2a4.8 4.8 0 0 1 3.9-2 4.6 4.6 0 0 1 4.6 4.6c0 3.8-3.3 6.9-8.5 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {!p.inStock && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-[2px]">
              <span className="rounded-full border border-white/20 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">Sold Out</span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-1 flex-col px-6 pb-6 pt-2">
          <div className="flex items-center justify-between gap-2">
            {p.category && <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog/60">{p.category}</span>}
            <span className="h-px flex-1 bg-white/[0.04]" />
          </div>
          
          <h3 className="mt-2 text-[16px] font-bold leading-tight tracking-tight text-white/90 transition-colors group-hover:text-white">{p.name}</h3>
          
          <div className="mt-auto flex items-end justify-between pt-4">
            <div className="flex flex-col">
              {off > 0 && <span className="text-[11px] font-medium text-fog/50 line-through tabular-nums">{formatINR(p.price)}</span>}
              <span className="text-[17px] font-black tabular-nums text-white">{formatINR(p.salePrice ?? p.price)}</span>
            </div>
            
            <div className="grid size-8 place-items-center rounded-full border border-white/10 opacity-0 transition-all duration-500 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:bg-acid hover:text-black hover:border-acid">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </Link>
    </Tilt>
  );
}
