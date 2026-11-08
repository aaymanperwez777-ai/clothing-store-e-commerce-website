"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, QtyStepper } from "@/components/cart";
import { formatINR } from "@/lib/utils";

export function CartPage() {
  const { cart, loaded, update, remove } = useCart();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("fc_coupon");
    if (saved) setTimeout(() => setCoupon(saved), 0);
  }, []);

  async function applyCoupon() {
    setCouponMsg("");
    if (!coupon.trim()) return;
    const res = await fetch("/api/coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: coupon.trim(), subtotal: cart.subtotal }),
    });
    const data = await res.json();
    if (res.ok) {
      setApplied({ code: data.code, discount: data.discount, label: data.label });
      localStorage.setItem("fc_coupon", data.code);
      setCouponMsg(`Applied — ${data.label}`);
    } else {
      setApplied(null);
      localStorage.removeItem("fc_coupon");
      setCouponMsg(data.error ?? "Invalid coupon.");
    }
  }

  function clearCoupon() {
    setApplied(null);
    setCoupon("");
    localStorage.removeItem("fc_coupon");
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-36 sm:px-6" aria-busy="true">
        <div className="h-9 w-48 animate-pulse-soft rounded-2xl bg-white/5" />
        <div className="mt-8 h-40 animate-pulse-soft rounded-[2rem] bg-white/5" />
      </div>
    );
  }

  const shippingFee = cart.subtotal - (applied?.discount ?? 0) >= 149900 || cart.lines.length === 0 ? 0 : 9900;
  const total = cart.subtotal - (applied?.discount ?? 0) + shippingFee;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-32 sm:px-6">
      <p className="kicker">Your selection</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">
        Cart <span className="font-editorial italic font-normal text-fog">({cart.count})</span>
      </h1>

      {cart.lines.length === 0 ? (
        <div className="surface-card mt-10 grid place-items-center gap-4 rounded-[2rem] py-24 text-center">
          <p className="text-lg font-bold">Your cart is empty</p>
          <p className="max-w-xs text-sm text-fog">Heavyweight tees and limited drops are waiting. Go find your piece.</p>
          <Link href="/shop" className="btn btn-acid mt-2">Shop now</Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <ul className="flex flex-col gap-4">
            {cart.lines.map((l) => (
              <li key={l.itemId} className="surface-card flex gap-5 !rounded-[1.9rem] p-4">
                <Link href={`/product/${l.slug}`} className="relative h-32 w-24 shrink-0 overflow-hidden rounded-[1.3rem] bg-charcoal">
                  {l.image && <Image src={l.image} alt={l.name} fill sizes="96px" className="object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/product/${l.slug}`} className="font-semibold leading-snug">{l.name}</Link>
                      <p className="mt-1 text-xs text-fog">
                        Size {l.size} · <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full align-middle" style={{ background: l.colorHex }} />{l.colorName}</span>
                      </p>
                      {l.qty > l.stock && <p className="mt-1 text-xs font-semibold text-danger">Only {l.stock} available — please reduce quantity</p>}
                      {l.stock > 0 && l.stock <= 3 && <p className="mt-1 text-xs text-acid">Only {l.stock} left</p>}
                    </div>
                    <button onClick={() => remove(l.itemId)} aria-label={`Remove ${l.name} from cart`} className="grid size-9 place-items-center rounded-full border border-line text-fog transition hover:text-danger">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h10l1-13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QtyStepper qty={l.qty} max={Math.min(10, l.stock)} onChange={(n) => update(l.itemId, n)} />
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{formatINR(l.unitPrice * l.qty)}</p>
                      {l.salePrice != null && l.salePrice < l.price && (
                        <p className="text-xs text-fog line-through tabular-nums">{formatINR(l.price * l.qty)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="surface-card h-fit !rounded-[2rem] p-7" aria-label="Order summary">
            <h2 className="text-lg font-black">Summary</h2>

            <div className="mt-5">
              <label htmlFor="coupon" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Coupon code</label>
              <div className="flex gap-2">
                <input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="WELCOME10" className="input !py-2.5 !text-sm uppercase" />
                {applied ? (
                  <button type="button" onClick={clearCoupon} className="btn btn-ghost !py-2.5 !text-[13px]">Remove</button>
                ) : (
                  <button type="button" onClick={applyCoupon} className="btn btn-ghost !py-2.5 !text-[13px]">Apply</button>
                )}
              </div>
              {couponMsg && <p className={`mt-2 text-xs ${applied ? "text-acid" : "text-danger"}`}>{couponMsg}</p>}
            </div>

            <dl className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between"><dt className="text-fog">Subtotal</dt><dd className="tabular-nums">{formatINR(cart.subtotal)}</dd></div>
              {applied && (
                <div className="flex justify-between text-acid"><dt>Discount ({applied.code})</dt><dd className="tabular-nums">−{formatINR(applied.discount)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-fog">Shipping</dt><dd className="tabular-nums">{shippingFee === 0 ? "FREE" : formatINR(shippingFee)}</dd></div>
              {shippingFee > 0 && (
                <p className="text-[11px] text-fog">Add {formatINR(149900 - (cart.subtotal - (applied?.discount ?? 0)))} more for free shipping</p>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-4 text-base font-bold">
                <dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd>
              </div>
            </dl>

            <Link href="/checkout" className="btn btn-acid mt-6 w-full !py-3.5">
              Proceed to checkout
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
            <p className="mt-3 text-center text-[11px] text-fog">Secure checkout · UPI / Cards / COD</p>
          </aside>
        </div>
      )}
    </div>
  );
}
