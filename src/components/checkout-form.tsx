"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart";
import { formatINR } from "@/lib/utils";

export type PrefillAddress = {
  name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const IN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya",
  "Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal","Jammu & Kashmir","Ladakh","Puducherry",
];

export function CheckoutForm({
  email,
  prefill,
  codEnabled,
  shippingFee,
  freeOver,
  estimate,
}: {
  email: string;
  prefill: PrefillAddress | null;
  codEnabled: boolean;
  shippingFee: number;
  freeOver: number;
  estimate: string;
}) {
  const { cart, loaded, refresh } = useCart();
  const router = useRouter();
  const [method, setMethod] = useState<"razorpay" | "cod">(codEnabled ? "cod" : "razorpay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const idem = useRef<string>("");

  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    email,
    phone: prefill?.phone ?? "",
    phoneConfirmed: false,
    line1: prefill?.line1 ?? "",
    line2: prefill?.line2 ?? "",
    city: prefill?.city ?? "",
    state: prefill?.state ?? "",
    pincode: prefill?.pincode ?? "",
    notes: "",
    saveAddress: true,
  });

  useEffect(() => {
    setCouponCode(localStorage.getItem("fc_coupon") ?? "");
  }, []);

  const discountPreview = 0; // discount finalized server-side; summary shows subtotal + shipping
  const shipping = cart.subtotal - discountPreview >= freeOver || cart.lines.length === 0 ? 0 : shippingFee;
  const total = cart.subtotal - discountPreview + shipping;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  if (!loaded) {
    return <div className="mt-10 h-64 animate-pulse-soft rounded-[2rem] bg-white/5" aria-busy="true" />;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="surface-card mt-10 grid place-items-center gap-4 rounded-[2rem] py-24 text-center">
        <p className="text-lg font-bold">Your cart is empty</p>
        <Link href="/shop" className="btn btn-acid">Back to the shop</Link>
      </div>
    );
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!idem.current) idem.current = crypto.randomUUID();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, method, coupon: couponCode, idempotencyKey: idem.current }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout failed. Please try again.");
        if (data.code === "PAYMENTS_NOT_CONFIGURED" && codEnabled) setMethod("cod");
        return;
      }
      if (data.duplicate) {
        idem.current = crypto.randomUUID();
        localStorage.removeItem("fc_coupon");
        await refresh();
        router.push(`/order/${data.orderNumber}`);
        return;
      }

      if (data.method === "cod") {
        idem.current = crypto.randomUUID();
        localStorage.removeItem("fc_coupon");
        await refresh();
        router.push(`/order/${data.orderNumber}?placed=1`);
        return;
      }

      // Online payment via Razorpay (sandbox unless live keys configured)
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        setError("Could not load the payment window. Your order is saved — you can retry payment from your orders.");
        return;
      }
      const rzp = new window.Razorpay({
        key: data.razorpay.keyId,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        name: "CLOTHING STORE",
        description: `Order ${data.orderNumber}`,
        order_id: data.razorpay.orderId,
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: "#ffffff" },
        modal: {
          ondismiss: () => {
            setError("Payment was not completed. Your order is saved as pending — retry from your orders page.");
          },
        },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const vres = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderNumber: data.orderNumber,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }),
          });
          if (vres.ok) {
            idem.current = crypto.randomUUID();
            localStorage.removeItem("fc_coupon");
            await refresh();
            router.push(`/order/${data.orderNumber}?placed=1`);
          } else {
            const vdata = await vres.json();
            setError(vdata.error ?? "Payment verification failed. If money was debited, it will auto-refund.");
          }
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={placeOrder} className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        {/* contact */}
        <section className="surface-card !rounded-[2rem] p-7" aria-labelledby="co-contact">
          <h2 id="co-contact" className="text-lg font-black">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="co-email" className="mb-1.5 block text-xs font-semibold text-fog">Email *</label>
              <input id="co-email" type="email" required value={form.email} onChange={set("email")} className="input" placeholder="you@email.com" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="co-phone" className="mb-1.5 block text-xs font-semibold text-fog">Phone (10-digit) *</label>
              <input id="co-phone" type="tel" required value={form.phone} onChange={set("phone")} className="input" placeholder="98765 43210" autoComplete="tel" />
            </div>
            <label className="mt-3 flex items-start gap-3 text-xs leading-relaxed text-fog sm:col-span-2">
              <input type="checkbox" required checked={form.phoneConfirmed} onChange={set("phoneConfirmed")} className="mt-0.5 size-4 shrink-0 accent-current" />
              <span>I confirm this is my correct mobile number and that I can be contacted about my order. I understand that this number has not been verified by SMS.</span>
            </label>
          </div>
        </section>

        {/* shipping */}
        <section className="surface-card !rounded-[2rem] p-7" aria-labelledby="co-ship">
          <h2 id="co-ship" className="text-lg font-black">Delivery address</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label htmlFor="co-name" className="mb-1.5 block text-xs font-semibold text-fog">Full name *</label>
              <input id="co-name" required minLength={2} value={form.name} onChange={set("name")} className="input" autoComplete="name" />
            </div>
            <div>
              <label htmlFor="co-line1" className="mb-1.5 block text-xs font-semibold text-fog">Address line 1 *</label>
              <input id="co-line1" required minLength={3} value={form.line1} onChange={set("line1")} className="input" placeholder="Flat / house no., street" autoComplete="address-line1" />
            </div>
            <div>
              <label htmlFor="co-line2" className="mb-1.5 block text-xs font-semibold text-fog">Address line 2</label>
              <input id="co-line2" value={form.line2} onChange={set("line2")} className="input" placeholder="Landmark, area (optional)" autoComplete="address-line2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="co-city" className="mb-1.5 block text-xs font-semibold text-fog">City *</label>
                <input id="co-city" required value={form.city} onChange={set("city")} className="input" autoComplete="address-level2" />
              </div>
              <div>
                <label htmlFor="co-state" className="mb-1.5 block text-xs font-semibold text-fog">State *</label>
                <select id="co-state" required value={form.state} onChange={set("state")} className="input">
                  <option value="">Select…</option>
                  {IN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="co-pin" className="mb-1.5 block text-xs font-semibold text-fog">PIN code *</label>
                <input id="co-pin" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.pincode} onChange={set("pincode")} className="input" placeholder="560001" autoComplete="postal-code" />
              </div>
            </div>
            <div>
              <label htmlFor="co-notes" className="mb-1.5 block text-xs font-semibold text-fog">Order notes</label>
              <textarea id="co-notes" rows={2} value={form.notes} onChange={set("notes")} className="input resize-none" placeholder="Delivery instructions (optional)" />
            </div>
            <label className="flex items-center gap-2.5 text-sm text-fog">
              <input type="checkbox" checked={form.saveAddress} onChange={set("saveAddress")} className="size-4 accent-white" />
              Save this address to my account
            </label>
          </div>
        </section>

        {/* payment */}
        <section className="surface-card !rounded-[2rem] p-7" aria-labelledby="co-pay">
          <h2 id="co-pay" className="text-lg font-black">Payment method</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label
              data-active={method === "razorpay"}
              className="flex cursor-pointer gap-4 rounded-3xl border border-line p-5 transition has-checked:border-acid has-checked:bg-acid/[0.06]"
            >
              <input type="radio" name="method" value="razorpay" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} className="mt-1 size-4 accent-white" />
              <span>
                <span className="block font-bold">Pay online</span>
                <span className="mt-1 block text-xs leading-relaxed text-fog">UPI · Cards · Netbanking · Wallets via Razorpay (sandbox until live keys are added)</span>
              </span>
            </label>
            <label
              data-active={method === "cod"}
              className={`flex gap-4 rounded-3xl border border-line p-5 transition ${codEnabled ? "cursor-pointer has-checked:border-acid has-checked:bg-acid/[0.06]" : "cursor-not-allowed opacity-40"}`}
            >
              <input type="radio" name="method" value="cod" disabled={!codEnabled} checked={method === "cod"} onChange={() => setMethod("cod")} className="mt-1 size-4 accent-white" />
              <span>
                <span className="block font-bold">Cash on Delivery</span>
                <span className="mt-1 block text-xs leading-relaxed text-fog">
                  {codEnabled ? "Pay by cash or UPI when your order arrives" : "Currently unavailable"}
                </span>
              </span>
            </label>
          </div>
        </section>
      </div>

      {/* summary */}
      <aside className="surface-card h-fit !rounded-[2rem] p-7 lg:sticky lg:top-28" aria-label="Order summary">
        <h2 className="text-lg font-black">Your order</h2>
        <ul className="mt-5 flex max-h-72 flex-col gap-3 overflow-y-auto">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex items-center gap-3">
              <span className="relative block size-14 shrink-0 overflow-hidden rounded-2xl bg-black">
                {l.image && <Image src={l.image} alt={l.name} fill sizes="56px" className="object-cover" />}
                <span className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-acid text-[10px] font-bold text-acid-ink">{l.qty}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{l.name}</span>
                <span className="text-xs text-fog">{l.size} · {l.colorName}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatINR(l.unitPrice * l.qty)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5 text-sm">
          <div className="flex justify-between"><dt className="text-fog">Subtotal</dt><dd className="tabular-nums">{formatINR(cart.subtotal)}</dd></div>
          {couponCode && <div className="flex justify-between text-acid"><dt>Coupon</dt><dd>{couponCode}</dd></div>}
          <div className="flex justify-between"><dt className="text-fog">Shipping</dt><dd className="tabular-nums">{shipping === 0 ? "FREE" : formatINR(shipping)}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatINR(total)}{couponCode ? "*" : ""}</dd>
          </div>
          {couponCode && <p className="text-[11px] text-fog">*coupon discount applied on the server at order placement</p>}
        </dl>
        <p className="mt-3 text-xs text-fog">Delivery estimate: {estimate}</p>

        <button type="submit" disabled={busy} className="btn btn-acid mt-6 w-full !py-4 !text-[15px]">
          {busy ? "Placing order…" : method === "cod" ? "Place order — pay on delivery" : "Continue to payment"}
        </button>
        {error && (
          <p role="alert" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-fog">
          Prices are verified server-side. Orders are protected against duplicate submission.
        </p>
      </aside>
    </form>
  );
}
