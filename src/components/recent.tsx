"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatINR } from "@/lib/utils";

export type RecentItem = { slug: string; name: string; price: number; salePrice: number | null; image: string | null };
const KEY = "fc_recent";

export function recordProductView(item: RecentItem) {
  try {
    const list: RecentItem[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const next = [item, ...list.filter((i) => i.slug !== item.slug)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    try {
      const list: RecentItem[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      setItems(list.filter((i) => i.slug !== exclude).slice(0, 6));
    } catch {}
  }, [exclude]);

  if (items.length === 0) return null;
  return (
    <section aria-label="Recently viewed" className="mt-20">
      <h2 className="text-xl font-bold tracking-tight">
        Recently <span className="font-editorial italic font-normal text-fog">viewed</span>
      </h2>
      <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {items.map((i) => (
          <Link
            key={i.slug}
            href={`/product/${i.slug}`}
            className="group flex w-44 shrink-0 flex-col overflow-hidden rounded-3xl border border-line bg-white/[0.02] transition hover:bg-white/[0.05]"
          >
            <span className="relative block aspect-square overflow-hidden bg-charcoal">
              {i.image && <Image src={i.image} alt={i.name} fill sizes="180px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
            </span>
            <span className="block p-3">
              <span className="block truncate text-[13px] font-semibold">{i.name}</span>
              <span className="mt-0.5 block text-xs text-fog tabular-nums">{formatINR(i.salePrice ?? i.price)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
