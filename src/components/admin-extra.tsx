"use client";

import { useCallback, useEffect, useState } from "react";
import { formatINR, DELIVERY_STATUS_LABELS } from "@/lib/utils";
import type { HomepageSections } from "@/lib/homepage-sections";

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(path, init ? { headers: { "Content-Type": "application/json" }, ...init } : undefined);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export type SiteSettingsBundle = {
  hero: { kicker: string; title: string; subtitle: string; image: string; cta: string };
  promo: { enabled: boolean; text: string; cta: string; href: string };
  social: { instagram: string; instagramImages: { url: string; alt: string }[] };
  contact: { email: string; phone: string; address: string; city: string };
  shipping: { fee: number; freeOver: number; codEnabled: boolean; estimate: string };
  testimonials: { name: string; location: string; quote: string; rating: number }[];
  homepageSections: HomepageSections;
};

/* ============================== CUSTOMERS ============================== */

type AdminCustomer = { id: string; name: string; email: string; phone: string | null; role: string; createdAt: string; orderCount: number; totalSpent: number };

export function CustomersPanel() {
  const [rows, setRows] = useState<AdminCustomer[] | null>(null);
  useEffect(() => {
    api<{ customers: AdminCustomer[] }>("/api/admin/customers").then(({ ok, data }) => ok && setRows(data.customers));
  }, []);
  if (!rows) return <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" />;
  return (
    <div className="surface-card overflow-x-auto !rounded-[2rem]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.16em] text-fog">
            <th className="px-6 py-4">Customer</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Joined</th><th className="px-6 py-4">Orders</th><th className="px-6 py-4">Total spent</th><th className="px-6 py-4">Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-line/60 last:border-0">
              <td className="px-6 py-3.5 font-semibold">{c.name}</td>
              <td className="px-6 py-3.5 text-fog">{c.email}{c.phone ? ` · ${c.phone}` : ""}</td>
              <td className="px-6 py-3.5 text-fog">{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
              <td className="px-6 py-3.5 tabular-nums">{c.orderCount}</td>
              <td className="px-6 py-3.5 tabular-nums">{formatINR(Number(c.totalSpent))}</td>
              <td className="px-6 py-3.5"><span className={`chip !text-[11px] ${c.role === "admin" ? "border-acid/60 text-acid" : ""}`}>{c.role}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================== COUPONS ============================== */

type AdminCoupon = { id: string; code: string; type: "percent" | "fixed"; value: number; minOrder: number; maxUses: number | null; usedCount: number; expiresAt: string | null; active: boolean };

export function CouponsPanel() {
  const [rows, setRows] = useState<AdminCoupon[] | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await api<{ coupons: AdminCoupon[] }>("/api/admin/coupons");
    if (ok) setRows(data.coupons);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await api<{ error?: string }>("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify({
        code: String(fd.get("code")),
        type: String(fd.get("type")),
        value: fd.get("type") === "fixed" ? Math.round(Number(fd.get("value")) * 100) : Number(fd.get("value")),
        minOrder: Math.round(Number(fd.get("minOrder") || 0) * 100),
        maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : null,
        expiresAt: fd.get("expiresAt") ? String(fd.get("expiresAt")) : null,
      }),
    });
    setMsg(ok ? "Coupon created." : (data.error ?? "Failed."));
    if (ok) { (e.target as HTMLFormElement).reset(); load(); }
  }

  async function toggle(c: AdminCoupon) {
    await api("/api/admin/coupons", { method: "PATCH", body: JSON.stringify({ id: c.id, active: !c.active }) });
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={create} className="surface-card h-fit !rounded-[2rem] p-6">
        <h2 className="font-black">Create coupon</h2>
        <div className="mt-4 flex flex-col gap-3">
          <input name="code" required minLength={3} placeholder="CODE e.g. STORE20" className="input uppercase" aria-label="Coupon code" />
          <div className="grid grid-cols-2 gap-3">
            <select name="type" className="input" aria-label="Discount type" defaultValue="percent">
              <option value="percent">% percent</option>
              <option value="fixed">₹ fixed</option>
            </select>
            <input name="value" required type="number" min={1} placeholder="Value" className="input" aria-label="Value" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="minOrder" type="number" min={0} placeholder="Min order ₹" className="input" aria-label="Minimum order" />
            <input name="maxUses" type="number" min={1} placeholder="Max uses" className="input" aria-label="Maximum uses" />
          </div>
          <label className="text-xs text-fog">Expires on
            <input name="expiresAt" type="date" className="input mt-1" />
          </label>
          <button type="submit" className="btn btn-acid">Create</button>
          {msg && <p className="text-sm text-acid">{msg}</p>}
        </div>
      </form>

      <div>
        {!rows ? (
          <div className="h-40 animate-pulse-soft rounded-[2rem] bg-white/5" />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((c) => (
              <li key={c.id} className="surface-card flex flex-wrap items-center justify-between gap-3 !rounded-[1.6rem] p-5">
                <div>
                  <p className="font-black tracking-wide">{c.code}</p>
                  <p className="text-xs text-fog">
                    {c.type === "percent" ? `${c.value}% off` : `${formatINR(c.value)} off`}
                    {c.minOrder > 0 && ` · min ${formatINR(c.minOrder)}`}
                    {c.maxUses != null && ` · ${c.usedCount}/${c.maxUses} used`}
                    {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-IN")}`}
                  </p>
                </div>
                <button onClick={() => toggle(c)} className="chip !text-[11px]" data-active={c.active}>{c.active ? "Active" : "Disabled"}</button>
              </li>
            ))}
            {rows.length === 0 && <li className="surface-card rounded-[2rem] py-14 text-center text-sm text-fog">No coupons yet.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================== INVENTORY ============================== */

type InvRow = { id: string; sku: string; size: string; color: string; stock: number; product: string };

export function InventoryPanel() {
  const [rows, setRows] = useState<InvRow[] | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await api<{ inventory: InvRow[] }>("/api/admin/inventory");
    if (ok) setRows(data.inventory);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function adjust(v: InvRow, change: number) {
    if (change === 0) return;
    const { ok, data } = await api<{ error?: string }>("/api/admin/restock", {
      method: "POST",
      body: JSON.stringify({ variantId: v.id, change, reason: "manual_adjustment" }),
    });
    setMsg(ok ? `${v.product} (${v.size}/${v.color}) adjusted by ${change > 0 ? "+" : ""}${change}` : (data.error ?? "Failed."));
    load();
  }

  if (!rows) return <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" />;
  return (
    <div>
      {msg && <p className="mb-4 text-sm text-acid">{msg}</p>}
      <div className="surface-card overflow-x-auto !rounded-[2rem]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.16em] text-fog">
              <th className="px-6 py-4">Variant</th><th className="px-6 py-4">SKU</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-3.5"><span className="font-semibold">{v.product}</span> <span className="text-fog">· {v.size} / {v.color}</span></td>
                <td className="px-6 py-3.5 font-mono text-xs text-fog">{v.sku}</td>
                <td className="px-6 py-3.5">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${v.stock === 0 ? "bg-danger/15 text-danger" : v.stock <= 3 ? "bg-acid/15 text-acid" : "bg-white/[0.06]"}`}>{v.stock}</span>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {[-5, -1, 1, 5, 20].map((n) => (
                      <button key={n} onClick={() => adjust(v, n)} className="chip !px-3 !py-1 !text-[11px]" aria-label={`${n > 0 ? "Add" : "Remove"} ${Math.abs(n)} units`}>
                        {n > 0 ? `+${n}` : n}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== REVIEWS ============================== */

type AdminReview = { id: string; rating: number; comment: string; approved: boolean; createdAt: string; user: string; product: string };

export function ReviewsPanel() {
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const load = useCallback(async () => {
    const { ok, data } = await api<{ reviews: AdminReview[] }>("/api/admin/reviews");
    if (ok) setRows(data.reviews);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setApproved(r: AdminReview, approved: boolean) {
    await api("/api/admin/reviews", { method: "PATCH", body: JSON.stringify({ id: r.id, approved }) });
    load();
  }
  async function remove(r: AdminReview) {
    if (!confirm("Delete this review?")) return;
    await api(`/api/admin/reviews?id=${r.id}`, { method: "DELETE" });
    load();
  }

  if (!rows) return <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" />;
  return (
    <ul className="flex flex-col gap-3">
      {rows.length === 0 && <li className="surface-card rounded-[2rem] py-14 text-center text-sm text-fog">No reviews yet.</li>}
      {rows.map((r) => (
        <li key={r.id} className="surface-card flex flex-wrap items-center justify-between gap-3 !rounded-[1.6rem] p-5">
          <div>
            <p className="text-sm"><span className="font-bold">{r.user}</span> on <span className="font-semibold">{r.product}</span> <span className="text-acid">{"â˜…".repeat(r.rating)}</span></p>
            <p className="mt-1 max-w-2xl text-sm text-fog">â€œ{r.comment}â€</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setApproved(r, !r.approved)} className="chip !text-[11px]" data-active={r.approved}>{r.approved ? "Published" : "Approve"}</button>
            <button onClick={() => remove(r)} className="btn btn-ghost !px-4 !py-2 !text-[12px] hover:!text-danger">Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ============================== CONTENT / WEBSITE ============================== */

export function ContentPanel({ settings, categories }: { settings: SiteSettingsBundle; categories: { id: string; name: string }[] }) {
  const [s, setS] = useState(settings);
  const [msg, setMsg] = useState("");
  const [newCat, setNewCat] = useState("");

  async function save(key: string, value: unknown) {
    const { ok } = await api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
    setMsg(ok ? `Saved "${key}".` : `Failed to save ${key}.`);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    const { ok, data } = await api<{ error?: string }>("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: newCat.trim() }) });
    setMsg(ok ? `Category "${newCat.trim()}" created â€” reload to use it.` : (data.error ?? "Failed."));
    setNewCat("");
  }

  const inputCls = "input";
  const sectionOptions: { key: keyof HomepageSections; label: string }[] = [
    { key: "hero", label: "Main hero banner" },
    { key: "carousel", label: "3D product carousel" },
    { key: "marquee", label: "Scrolling text strip" },
    { key: "categoryNav", label: "Category navigation" },
    { key: "promo", label: "Promotional banner" },
    { key: "newArrivals", label: "New arrivals" },
    { key: "bestSellers", label: "Best sellers" },
    { key: "onSale", label: "On-sale products" },
    { key: "benefits", label: "Store benefits" },
    { key: "categoryGrids", label: "Products by category" },
    { key: "uncategorised", label: "More products" },
    { key: "collections", label: "Collections showcase" },
    { key: "story", label: "Brand story" },
    { key: "instagram", label: "Instagram gallery" },
    { key: "testimonials", label: "Customer testimonials" },
    { key: "newsletter", label: "Newsletter signup" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {msg && <p className="text-sm text-acid lg:col-span-2">{msg}</p>}

      {/* homepage section visibility */}
      <section className="surface-card !rounded-[2rem] p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black">Homepage Sections</h2>
            <p className="mt-1 text-xs text-fog">Choose which sections appear on your live homepage.</p>
          </div>
          <button onClick={() => save("homepage_sections", s.homepageSections)} className="btn btn-acid">
            Save section settings
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectionOptions.map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-sm transition-colors hover:bg-white/[0.03]">
              <input
                type="checkbox"
                checked={s.homepageSections[key]}
                onChange={(e) => setS({ ...s, homepageSections: { ...s.homepageSections, [key]: e.target.checked } })}
                className="size-4 accent-white"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* shipping & COD */}
      <section className="surface-card !rounded-[2rem] p-6">
        <h2 className="font-black">Shipping &amp; COD</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-xs text-fog">Shipping fee (₹ â€” free over threshold applies)
            <input type="number" className={inputCls + " mt-1"} value={s.shipping.fee / 100} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, fee: Math.round(Number(e.target.value) * 100) } })} />
          </label>
          <label className="text-xs text-fog">Free shipping above (₹)
            <input type="number" className={inputCls + " mt-1"} value={s.shipping.freeOver / 100} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, freeOver: Math.round(Number(e.target.value) * 100) } })} />
          </label>
          <label className="text-xs text-fog">Delivery estimate text
            <input className={inputCls + " mt-1"} value={s.shipping.estimate} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, estimate: e.target.value } })} />
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={s.shipping.codEnabled} onChange={(e) => setS({ ...s, shipping: { ...s.shipping, codEnabled: e.target.checked } })} className="size-4 accent-white" />
            Cash on Delivery enabled
          </label>
          <button onClick={() => save("shipping", s.shipping)} className="btn btn-acid w-fit">Save shipping</button>
        </div>
      </section>

      {/* hero */}
      <section className="surface-card !rounded-[2rem] p-6">
        <h2 className="font-black">Homepage hero</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-xs text-fog">Kicker
            <input className={inputCls + " mt-1"} value={s.hero.kicker} onChange={(e) => setS({ ...s, hero: { ...s.hero, kicker: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Title
            <input className={inputCls + " mt-1"} value={s.hero.title} onChange={(e) => setS({ ...s, hero: { ...s.hero, title: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Subtitle
            <textarea rows={2} className={inputCls + " mt-1 resize-none"} value={s.hero.subtitle} onChange={(e) => setS({ ...s, hero: { ...s.hero, subtitle: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Hero image URL
            <input className={inputCls + " mt-1"} value={s.hero.image} onChange={(e) => setS({ ...s, hero: { ...s.hero, image: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">CTA label
            <input className={inputCls + " mt-1"} value={s.hero.cta} onChange={(e) => setS({ ...s, hero: { ...s.hero, cta: e.target.value } })} />
          </label>
          <button onClick={() => save("hero", s.hero)} className="btn btn-acid w-fit">Save hero</button>
        </div>
      </section>

      {/* promo */}
      <section className="surface-card !rounded-[2rem] p-6">
        <h2 className="font-black">Promotional banner</h2>
        <div className="mt-4 grid gap-3">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={s.promo.enabled} onChange={(e) => setS({ ...s, promo: { ...s.promo, enabled: e.target.checked } })} className="size-4 accent-white" />
            Banner visible
          </label>
          <label className="text-xs text-fog">Text
            <input className={inputCls + " mt-1"} value={s.promo.text} onChange={(e) => setS({ ...s, promo: { ...s.promo, text: e.target.value } })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-fog">CTA label
              <input className={inputCls + " mt-1"} value={s.promo.cta} onChange={(e) => setS({ ...s, promo: { ...s.promo, cta: e.target.value } })} />
            </label>
            <label className="text-xs text-fog">CTA link
              <input className={inputCls + " mt-1"} value={s.promo.href} onChange={(e) => setS({ ...s, promo: { ...s.promo, href: e.target.value } })} />
            </label>
          </div>
          <button onClick={() => save("promo", s.promo)} className="btn btn-acid w-fit">Save banner</button>
        </div>
      </section>

      {/* contact + social */}
      <section className="surface-card !rounded-[2rem] p-6">
        <h2 className="font-black">Contact &amp; social</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-xs text-fog">Support email
            <input className={inputCls + " mt-1"} value={s.contact.email} onChange={(e) => setS({ ...s, contact: { ...s.contact, email: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Phone
            <input className={inputCls + " mt-1"} value={s.contact.phone} onChange={(e) => setS({ ...s, contact: { ...s.contact, phone: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Address
            <input className={inputCls + " mt-1"} value={s.contact.address} onChange={(e) => setS({ ...s, contact: { ...s.contact, address: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Instagram profile URL
            <input className={inputCls + " mt-1"} value={s.social.instagram} onChange={(e) => setS({ ...s, social: { ...s.social, instagram: e.target.value } })} />
          </label>
          <label className="text-xs text-fog">Instagram gallery images â€” one authorised image URL per line
            <textarea rows={4} className={inputCls + " mt-1 resize-none font-mono text-xs"} value={s.social.instagramImages.map((i) => i.url).join("\n")}
              onChange={(e) => setS({ ...s, social: { ...s.social, instagramImages: e.target.value.split("\n").map((u) => u.trim()).filter(Boolean).map((url) => ({ url, alt: "CLOTHING STORE Instagram post" })) } })} />
          </label>
          <div className="flex gap-2">
            <button onClick={() => save("contact", s.contact)} className="btn btn-acid w-fit">Save contact</button>
            <button onClick={() => save("social", s.social)} className="btn btn-ghost w-fit">Save social</button>
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="surface-card !rounded-[2rem] p-6">
        <h2 className="font-black">Categories</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => <li key={c.id} className="chip !cursor-default">{c.name}</li>)}
        </ul>
        <form onSubmit={addCategory} className="mt-4 flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" className="input" aria-label="New category name" />
          <button type="submit" className="btn btn-acid">Add</button>
        </form>
      </section>

      {/* testimonials */}
      <section className="surface-card !rounded-[2rem] p-6 lg:col-span-2">
        <h2 className="font-black">Testimonials (genuine customer quotes only)</h2>
        <p className="mt-1 text-xs text-fog">One per line: Name | Location | Rating (1-5) | Quote</p>
        <textarea
          rows={5}
          className={inputCls + " mt-3 resize-none font-mono text-xs"}
          value={s.testimonials.map((t) => `${t.name} | ${t.location} | ${t.rating} | ${t.quote}`).join("\n")}
          onChange={(e) =>
            setS({
              ...s,
              testimonials: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
                const [name, location, rating, ...quote] = l.split("|").map((x) => x.trim());
                return { name, location, rating: Math.min(5, Math.max(1, parseInt(rating) || 5)), quote: quote.join(" | ") };
              }).filter((t) => t.name && t.quote),
            })
          }
        />
        <button onClick={() => save("testimonials", s.testimonials)} className="btn btn-acid mt-3 w-fit">Save testimonials</button>
      </section>
    </div>
  );
}

/* ============================== DELIVERY MANAGEMENT ============================== */

type AdminDriver = {
  id: string; name: string; phone: string; vehicle: string; active: boolean;
  userId: string; email: string; activeDeliveries: number; totalDeliveries: number;
};

type PendingOrder = {
  id: string; orderNumber: string; shippingName: string; phone: string;
  address: { line1: string; city: string; state: string; pincode: string };
  status: string; paymentMethod: string; total: number; createdAt: string; itemCount: number;
};

type ActiveAssignment = {
  id: string; orderId: string; orderNumber: string; driverId: string; driverName: string;
  status: string; shippingName: string; phone: string; total: number;
  deliveryNotes: string | null; assignedAt: string; updatedAt: string;
};

type HistoryRow = {
  id: string; orderNumber: string; driverName: string; status: string;
  shippingName: string; assignedAt: string; deliveredAt: string | null;
  deliveryNotes: string | null; otpVerified: boolean;
};

export function DeliveryPanel() {
  const [subTab, setSubTab] = useState<"pending" | "active" | "drivers" | "history">("pending");
  const [drivers, setDrivers] = useState<AdminDriver[] | null>(null);
  const [pending, setPending] = useState<PendingOrder[] | null>(null);
  const [active, setActive] = useState<ActiveAssignment[] | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [d, p, a, h] = await Promise.all([
      api<{ drivers: AdminDriver[] }>("/api/admin/delivery?view=drivers"),
      api<{ orders: PendingOrder[] }>("/api/admin/delivery?view=pending"),
      api<{ assignments: ActiveAssignment[] }>("/api/admin/delivery?view=active"),
      api<{ history: HistoryRow[] }>("/api/admin/delivery?view=history"),
    ]);
    if (d.ok) setDrivers(d.data.drivers);
    if (p.ok) setPending(p.data.orders);
    if (a.ok) setActive(a.data.assignments);
    if (h.ok) setHistory(h.data.history);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function assignOrder(orderId: string, driverId: string) {
    const { ok, data } = await api<{ error?: string; otp?: string }>("/api/admin/delivery", {
      method: "POST",
      body: JSON.stringify({ action: "assign", orderId, driverId }),
    });
    setMsg(ok ? `Assigned! Customer OTP: ${data.otp}` : (data.error ?? "Assignment failed."));
    load();
  }

  async function reassign(assignmentId: string, newDriverId: string) {
    const { ok, data } = await api<{ error?: string }>("/api/admin/delivery", {
      method: "POST",
      body: JSON.stringify({ action: "reassign", assignmentId, newDriverId }),
    });
    setMsg(ok ? "Reassigned successfully." : (data.error ?? "Reassignment failed."));
    load();
  }

  async function toggleDriver(driverId: string, active: boolean) {
    await api("/api/admin/delivery", {
      method: "POST",
      body: JSON.stringify({ action: "toggle_driver", driverId, active }),
    });
    load();
  }

  async function createDriver(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { ok, data } = await api<{ error?: string }>("/api/admin/delivery", {
      method: "POST",
      body: JSON.stringify({
        action: "create_driver",
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        vehicle: fd.get("vehicle"),
        password: fd.get("password"),
      }),
    });
    setMsg(ok ? "Driver account created." : (data.error ?? "Failed."));
    if (ok) { setCreating(false); load(); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fog">
          <span className="font-bold text-ivory">{drivers?.filter(d => d.active).length ?? 0}</span> active drivers ·{" "}
          <span className="font-bold text-ivory">{pending?.length ?? 0}</span> awaiting assignment ·{" "}
          <span className="font-bold text-ivory">{active?.length ?? 0}</span> in transit
        </p>
        <button onClick={() => setCreating(!creating)} className="btn btn-acid !py-2.5 !text-xs">+ Add Driver</button>
      </div>
      {msg && <p className="text-sm text-white/80 rounded-2xl border border-white/10 px-4 py-3">{msg}</p>}

      {creating && (
        <form onSubmit={createDriver} className="surface-card !rounded-[1.5rem] grid gap-3 p-6 sm:grid-cols-2">
          <input name="name" required placeholder="Driver name" className="input" />
          <input name="email" required type="email" placeholder="Email (for login)" className="input" />
          <input name="phone" required placeholder="Phone" className="input" />
          <input name="vehicle" placeholder="Vehicle (e.g. Bike, Van)" className="input" />
          <input name="password" required type="password" minLength={8} placeholder="Password (min 8)" className="input" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-acid">Create driver</button>
            <button type="button" onClick={() => setCreating(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      )}

      <div className="no-scrollbar flex gap-2 overflow-x-auto" role="tablist">
        {(["pending", "active", "drivers", "history"] as const).map((t) => (
          <button key={t} role="tab" onClick={() => setSubTab(t)} className="chip capitalize" data-active={subTab === t}>
            {t === "pending" ? `Pending (${pending?.length ?? 0})` : t === "active" ? `Active (${active?.length ?? 0})` : t === "drivers" ? `Drivers (${drivers?.length ?? 0})` : "History"}
          </button>
        ))}
      </div>

      {/* PENDING ORDERS */}
      {subTab === "pending" && (
        <ul className="flex flex-col gap-3">
          {!pending ? <li className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" /> :
           pending.length === 0 ? <li className="surface-card !rounded-[1.5rem] py-12 text-center text-sm text-fog">All orders have been assigned.</li> :
           pending.map((o) => (
            <li key={o.id} className="surface-card !rounded-[1.5rem] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{o.orderNumber}</p>
                  <p className="text-xs text-fog">{o.shippingName} · {(o.address as { city: string }).city} · {o.itemCount} items · {formatINR(o.total)} · {o.paymentMethod.toUpperCase()}</p>
                </div>
                {drivers && drivers.filter(d => d.active).length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      id={`assign-${o.id}`}
                      className="input !w-auto !py-2 !text-xs"
                      defaultValue=""
                      aria-label="Assign driver"
                    >
                      <option value="" disabled>Select driverâ€¦</option>
                      {drivers.filter(d => d.active).map((d) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.activeDeliveries} active)</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-acid !py-2 !text-xs"
                      onClick={() => {
                        const sel = document.getElementById(`assign-${o.id}`) as HTMLSelectElement;
                        if (sel.value) assignOrder(o.id, sel.value);
                      }}
                    >
                      Assign
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ACTIVE DELIVERIES */}
      {subTab === "active" && (
        <ul className="flex flex-col gap-3">
          {!active ? <li className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" /> :
           active.length === 0 ? <li className="surface-card !rounded-[1.5rem] py-12 text-center text-sm text-fog">No active deliveries.</li> :
           active.map((a) => (
            <li key={a.id} className="surface-card !rounded-[1.5rem] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">{a.orderNumber} <span className="text-fog">â†’</span> <span className="text-fog">{a.driverName}</span></p>
                  <p className="text-xs text-fog">{a.shippingName} · {DELIVERY_STATUS_LABELS[a.status]} · {formatINR(a.total)}</p>
                  {a.deliveryNotes && <p className="mt-1 text-[10px] text-fog/60">Note: {a.deliveryNotes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip !text-[10px]" data-active>{DELIVERY_STATUS_LABELS[a.status]}</span>
                  {drivers && (
                    <select
                      className="input !w-auto !py-2 !text-[10px]"
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) reassign(a.id, e.target.value); }}
                      aria-label="Reassign"
                    >
                      <option value="">Reassignâ€¦</option>
                      {drivers.filter(d => d.active && d.id !== a.driverId).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* DRIVERS */}
      {subTab === "drivers" && (
        <ul className="flex flex-col gap-3">
          {!drivers ? <li className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" /> :
           drivers.map((d) => (
            <li key={d.id} className="surface-card !rounded-[1.5rem] p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">{d.name} <span className="text-xs text-fog">({d.email})</span></p>
                <p className="text-xs text-fog">{d.phone} · {d.vehicle || "No vehicle"} · {d.activeDeliveries} active · {d.totalDeliveries} total</p>
              </div>
              <button onClick={() => toggleDriver(d.id, !d.active)} className="chip !text-[10px]" data-active={d.active}>
                {d.active ? "Active" : "Inactive"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* HISTORY */}
      {subTab === "history" && (
        <ul className="flex flex-col gap-3">
          {!history ? <li className="h-40 animate-pulse-soft rounded-[1.5rem] bg-white/5" /> :
           history.length === 0 ? <li className="surface-card !rounded-[1.5rem] py-12 text-center text-sm text-fog">No delivery history yet.</li> :
           history.map((h) => (
            <li key={h.id} className="surface-card !rounded-[1.5rem] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{h.orderNumber}</p>
                  <p className="text-xs text-fog">{h.shippingName} â†’ {h.driverName} · {h.deliveredAt ? new Date(h.deliveredAt).toLocaleDateString("en-IN") : ""}</p>
                  {h.deliveryNotes && <p className="mt-1 text-[10px] text-fog/60">{h.deliveryNotes}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="chip !text-[10px]" data-active={h.status === "delivered"}>{DELIVERY_STATUS_LABELS[h.status]}</span>
                  {h.otpVerified && <span className="text-[9px] text-white/50">OTP ✓</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


