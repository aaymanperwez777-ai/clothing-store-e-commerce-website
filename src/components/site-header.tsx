"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?sort=new", label: "New In" },
  { href: "/#collections", label: "Collections" },
  { href: "/#story", label: "Story" },
];

export function SiteHeader() {
  const { cart, setOpen } = useCart();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenu(false), [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-[60] px-3 pt-3 sm:px-5 sm:pt-5">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/[0.06] bg-black/80 backdrop-blur-2xl px-2 py-2 transition-all duration-700 ${
          scrolled
            ? "shadow-premium border-white/15 bg-black/90"
            : ""
        }`}
      >
        {/* ─── Logo: Circular badge ─── */}
        <Link
          href="/"
          className="group relative flex items-center gap-4 pl-1"
          aria-label="CLOTHING STORE home"
        >
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full border border-white/10 p-0.5 transition-transform duration-500 group-hover:rotate-[15deg]">
            <div className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-white/20 group-hover:ring-white/60 transition-all flex items-center justify-center bg-black">
              <Image
                src="/logo.svg"
                alt="CLOTHING STORE"
                fill
                className="object-contain p-2 scale-125"
                priority
              />
            </div>
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-[12px] font-black uppercase tracking-[0.3em] leading-none">CLOTHING</span>
            <span className="mt-1 font-editorial italic text-[16px] text-fog/60 leading-none">STORE</span>
          </div>
        </Link>

        {/* ─── Desktop nav ─── */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
                pathname === n.href
                  ? "bg-white/[0.08] text-ivory"
                  : "text-fog hover:bg-white/[0.05] hover:text-ivory"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* ─── Actions ─── */}
        <div className="flex items-center gap-1">
          <Link
            href="/shop?focus=search"
            aria-label="Search products"
            className="grid size-10 place-items-center rounded-full text-fog transition hover:bg-white/[0.06] hover:text-ivory"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="grid size-10 place-items-center rounded-full text-fog transition hover:bg-white/[0.06] hover:text-ivory"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M4.5 20c1.5-3.5 4.5-5 7.5-5s6 1.5 7.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label={`Open cart, ${cart.count} items`}
            className="relative grid h-10 min-w-10 place-items-center rounded-full bg-acid px-3.5 font-bold text-acid-ink transition-transform duration-300 hover:scale-[1.06] active:scale-[0.97]"
          >
            <span className="flex items-center gap-1.5 text-[12px]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 8h12l-1.2 11H7.2L6 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span className="tabular-nums" aria-live="polite">{cart.count}</span>
            </span>
          </button>
          <button
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-label="Menu"
            className="grid size-10 place-items-center rounded-full border border-line text-ivory md:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {menu ? (
                <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h12M2 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Mobile menu ─── */}
      <div
        className={`mx-auto mt-2 max-w-6xl overflow-hidden rounded-[1.75rem] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          menu ? "glass max-h-[26rem] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav aria-label="Mobile" className="flex flex-col p-3">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className="flex items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] font-semibold text-ivory transition hover:bg-white/[0.06]"
            >
              {n.label}
            </Link>
          ))}
          <Link href="/account" className="flex items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] font-semibold text-ivory transition hover:bg-white/[0.06]">
            Account &amp; orders
          </Link>
        </nav>
      </div>
    </header>
  );
}
