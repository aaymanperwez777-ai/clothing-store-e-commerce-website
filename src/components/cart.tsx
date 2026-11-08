"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatINR } from "@/lib/utils";

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
  unitPrice: number;
  price: number;
  salePrice: number | null;
};

export type CartData = { cartId: string | null; lines: CartLine[]; subtotal: number; count: number };
const EMPTY: CartData = { cartId: null, lines: [], subtotal: 0, count: 0 };

type CartCtx = {
  cart: CartData;
  loaded: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  refresh: () => Promise<void>;
  add: (variantId: string, qty?: number) => Promise<string | null>;
  update: (itemId: string, qty: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
};

const Ctx = createContext<CartCtx | null>(null);

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart outside provider");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.ok) setCart(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (variantId: string, qty = 1) => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, qty }),
      });
      const data = await res.json();
      if (!res.ok) return (data.error as string) ?? "Could not add to cart.";
      setCart(data);
      setOpen(true);
      return null;
    },
    []
  );

  const update = useCallback(async (itemId: string, qty: number) => {
    const res = await fetch("/api/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, qty }),
    });
    if (res.ok) setCart(await res.json());
  }, []);

  const remove = useCallback(async (itemId: string) => {
    const res = await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) setCart(await res.json());
  }, []);

  return (
    <Ctx.Provider value={{ cart, loaded, open, setOpen, refresh, add, update, remove }}>
      {children}
      <CartDrawer />
    </Ctx.Provider>
  );
}

export function QtyStepper({ qty, onChange, max }: { qty: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-charcoal p-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(0, qty - 1))}
        className="grid size-7 place-items-center rounded-full text-fog transition hover:bg-white/10 hover:text-ivory disabled:opacity-30"
        disabled={qty <= 0}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max ?? 10, qty + 1))}
        className="grid size-7 place-items-center rounded-full text-fog transition hover:bg-white/10 hover:text-ivory disabled:opacity-30"
        disabled={max != null && qty >= max}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

export function CartDrawer() {
  const { cart, open, setOpen, update, remove } = useCart();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <>
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[70] bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ backdropFilter: "blur(3px)" }}
      />
      <div className="fixed inset-0 z-[80] overflow-hidden pointer-events-none">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute inset-y-2 right-2 z-[80] pointer-events-auto flex w-[min(26rem,calc(100vw-1rem))] flex-col rounded-[2rem] border border-white/[0.06] bg-black/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          open ? "translate-x-0" : "translate-x-[110%]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-lg font-bold tracking-tight">
            Your cart <span className="font-editorial italic font-normal text-fog">({cart.count})</span>
          </h2>
          <button
            ref={closeRef}
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="grid size-9 place-items-center rounded-full border border-line text-fog transition hover:bg-white/10 hover:text-ivory"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="grid size-16 place-items-center rounded-full border border-line bg-white/[0.03]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-fog"><path d="M6 8h12l-1.2 11H7.2L6 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <p className="text-sm text-fog">Your cart is feeling empty.<br />Time to fix that.</p>
              <Link href="/shop" onClick={() => setOpen(false)} className="btn btn-acid mt-1">Shop the drop</Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.lines.map((l) => (
                <li key={l.itemId} className="flex gap-4 rounded-3xl border border-line bg-white/[0.02] p-3">
                  <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-charcoal">
                    {l.image && <Image src={l.image} alt={l.name} fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/product/${l.slug}`} onClick={() => setOpen(false)} className="truncate text-sm font-semibold leading-snug">
                        {l.name}
                      </Link>
                      <button onClick={() => remove(l.itemId)} aria-label={`Remove ${l.name}`} className="text-fog transition hover:text-danger">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h10l1-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-fog">
                      {l.size} · <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full" style={{ background: l.colorHex }} />{l.colorName}</span>
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <QtyStepper qty={l.qty} max={Math.min(10, l.stock)} onChange={(n) => update(l.itemId, n)} />
                      <span className="text-sm font-semibold tabular-nums">{formatINR(l.unitPrice * l.qty)}</span>
                    </div>
                    {l.stock <= 3 && <p className="mt-1 text-[11px] text-acid">Only {l.stock} left</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t border-white/[0.06] bg-black px-6 py-5">
            {/* Free Shipping Progress Bar */}
            <div className="mb-6 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-fog">
                <span>Shipping</span>
                {cart.subtotal >= 149900 ? (
                  <span className="text-white">Free Unlocked</span>
                ) : (
                  <span>Add {formatINR(149900 - cart.subtotal)} to unlock</span>
                )}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div 
                  className="h-full bg-white transition-all duration-700 ease-out" 
                  style={{ width: `${Math.min(100, (cart.subtotal / 149900) * 100)}%` }} 
                />
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="text-fog">Subtotal</span>
              <span className="text-lg font-bold tabular-nums">{formatINR(cart.subtotal)}</span>
            </div>
            <button
              className="btn btn-acid w-full"
              onClick={() => {
                setOpen(false);
                router.push("/checkout");
              }}
            >
              Checkout securely
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <p className="mt-3 text-center text-[11px] text-fog">Shipping &amp; discounts calculated at checkout · COD available</p>
          </div>
        )}
      </aside>
      </div>
    </>
  );
}
