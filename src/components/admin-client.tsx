"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatINR, ORDER_STATUS_LABELS } from "@/lib/utils";
import { CustomersPanel, CouponsPanel, InventoryPanel, ReviewsPanel, ContentPanel, DeliveryPanel, type SiteSettingsBundle } from "@/components/admin-extra";

async function api<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(path, init ? { headers: { "Content-Type": "application/json" }, ...init } : undefined);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function AdminShell({
  tab,
  categories,
  settings,
}: {
  tab: string;
  categories: { id: string; name: string }[];
  settings: SiteSettingsBundle;
}) {
  switch (tab) {
    case "overview": return <OverviewPanel />;
    case "products": return <ProductsPanel categories={categories} />;
    case "orders": return <OrdersPanel />;
    case "delivery": return <DeliveryPanel />;
    case "customers": return <CustomersPanel />;
    case "coupons": return <CouponsPanel />;
    case "inventory": return <InventoryPanel />;
    case "reviews": return <ReviewsPanel />;
    case "content": return <ContentPanel settings={settings} categories={categories} />;
    default: return <OverviewPanel />;
  }
}

/* ============================== OVERVIEW ============================== */

type Overview = {
  revenue: number; orders: number; pending: number; delivered: number; customers: number;
  avgOrderValue: number; pendingDeliveries: number; completedDeliveries: number;
  recent: { id: string; orderNumber: string; total: number; status: string; createdAt: string; shippingName: string }[];
  best: { name: string; qty: number; revenue: number }[];
  low: { id: string; product: string; size: string; color: string; stock: number; sku: string }[];
  daily: { day: string; total: number }[];
};

export function OverviewPanel() {
  const [d, setD] = useState<Overview | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Overview>("/api/admin/overview").then(({ ok, data }) => (ok ? setD(data) : setErr(data.error ?? "Failed to load")));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!d) return <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" aria-busy="true" />;

  const maxDay = Math.max(...d.daily.map((x) => Number(x.total)), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Revenue", formatINR(d.revenue), true],
          ["Orders", String(d.orders), false],
          ["AOV", formatINR(d.avgOrderValue), false],
          ["Customers", String(d.customers), false],
          ["Active Orders", String(d.pending), false],
          ["Delivered", String(d.delivered), false],
          ["Active Deliveries", String(d.pendingDeliveries), false],
          ["Completed Deliveries", String(d.completedDeliveries), false],
        ].map(([label, value, accent]) => (
          <div key={label as string} className="surface-card relative overflow-hidden !rounded-[1.6rem] p-5">
            {accent ? <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-acid/15 blur-2xl" /> : null}
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">{label}</p>
            <p className={`mt-2 text-2xl font-black tabular-nums ${accent ? "text-acid" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface-card !rounded-[2rem] p-6" aria-label="Revenue last 14 days">
          <h2 className="font-black">Revenue â€” last 14 days</h2>
          {d.daily.length === 0 ? (
            <p className="mt-6 text-sm text-fog">No sales data yet. Placed orders will appear here.</p>
          ) : (
            <div className="mt-6 flex h-44 items-end gap-1.5">
              {d.daily.map((day) => (
                <div key={day.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-acid/25 to-acid transition-all group-hover:to-acid-deep"
                    style={{ height: `${Math.max(4, (Number(day.total) / maxDay) * 100)}%` }}
                    title={`${day.day}: ${formatINR(Number(day.total))}`}
                  />
                  <span className="text-[9px] text-fog">{day.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-card !rounded-[2rem] p-6" aria-label="Best selling products">
          <h2 className="font-black">Best sellers</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {d.best.length === 0 && <li className="text-sm text-fog">No sales yet.</li>}
            {d.best.map((b, i) => (
              <li key={b.name} className="flex items-center gap-3 text-sm">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-acid/15 text-[11px] font-bold text-acid">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                <span className="text-fog tabular-nums">{b.qty} sold</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-card !rounded-[2rem] p-6" aria-label="Recent orders">
          <h2 className="font-black">Recent orders</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {d.recent.length === 0 && <li className="text-sm text-fog">No orders yet.</li>}
            {d.recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm transition hover:border-white/20">
                <div>
                  <p className="font-bold">{o.orderNumber}</p>
                  <p className="text-xs text-fog">{o.shippingName} · {new Date(o.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatINR(o.total)}</p>
                  <p className="text-xs text-fog">{ORDER_STATUS_LABELS[o.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card !rounded-[2rem] p-6" aria-label="Low stock alerts">
          <h2 className="font-black">Low stock alerts</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {d.low.length === 0 && <li className="text-sm text-fog">All variants healthy.</li>}
            {d.low.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{v.product}</p>
                  <p className="text-xs text-fog">{v.size} · {v.color} · {v.sku}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${v.stock === 0 ? "bg-danger/15 text-danger" : "bg-acid/15 text-acid"}`}>
                  {v.stock === 0 ? "Out" : `${v.stock} left`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ============================== PRODUCTS ============================== */

export type AdminVariant = { id: string; size: string; colorName: string; colorHex: string; sku: string; stock: number };
export type AdminProduct = {
  id: string; name: string; slug: string; description: string; brand: string; price: number; salePrice: number | null;
  featured: boolean; isNew: boolean; active: boolean; tags: string[];
  category: { id: string; name: string } | null;
  images: { id: string; url: string }[];
  variants: AdminVariant[];
};
export type AdminCategory = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  sort?: number;
  productCount?: number;
};

type EditVariant = { size: string; colorName: string; colorHex: string; stock: number };

const LBL = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-fog";

function CategoryManager({
  categories,
  onClose,
  onChanged,
}: {
  categories: AdminCategory[];
  onClose: () => void;
  onChanged: (rows: AdminCategory[]) => void;
}) {
  const [rows, setRows] = useState(categories);
  const [creating, setCreating] = useState({ name: "", description: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { ok, data } = await api<{ categories: AdminCategory[] }>("/api/admin/categories");
    if (ok) {
      setRows(data.categories);
      onChanged(data.categories);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!creating.name.trim()) return;
    setBusy(true);
    const { ok, data } = await api<{ error?: string }>("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name: creating.name.trim(), description: creating.description.trim() }),
    });
    setBusy(false);
    setMsg(ok ? `Created â€œ${creating.name.trim()}â€.` : (data.error ?? "Failed."));
    if (ok) {
      setCreating({ name: "", description: "" });
      await refresh();
    }
  }

  async function updateCategory(row: AdminCategory) {
    const { ok, data } = await api<{ error?: string }>("/api/admin/categories", {
      method: "PUT",
      body: JSON.stringify({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        image: row.image ?? null,
        sort: row.sort ?? 0,
      }),
    });
    setMsg(ok ? `Saved â€œ${row.name}â€.` : (data.error ?? "Failed."));
    if (ok) await refresh();
  }

  async function removeCategory(row: AdminCategory) {
    if (!confirm(`Delete category â€œ${row.name}â€? Products in it will become uncategorised.`)) return;
    const { ok } = await api(`/api/admin/categories?id=${row.id}`, { method: "DELETE" });
    setMsg(ok ? `Deleted â€œ${row.name}â€.` : "Delete failed.");
    if (ok) await refresh();
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 pt-8" role="dialog" aria-modal="true" aria-label="Manage categories">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="glass relative w-full max-w-3xl rounded-[2rem] bg-black p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <p className="kicker !text-sm">Organisation</p>
            <h3 className="text-xl font-black">Manage categories</h3>
          </div>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full border border-white/[0.08] text-fog hover:bg-white/10 hover:text-white" aria-label="Close category manager">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        <form onSubmit={createCategory} className="mt-5 grid gap-3 rounded-[1.5rem] border border-white/[0.06] p-4 sm:grid-cols-[1.1fr_1.4fr_auto]">
          <input value={creating.name} onChange={(e) => setCreating((s) => ({ ...s, name: e.target.value }))} placeholder="New category name" className="input" aria-label="New category name" />
          <input value={creating.description} onChange={(e) => setCreating((s) => ({ ...s, description: e.target.value }))} placeholder="Short description (optional)" className="input" aria-label="Category description" />
          <button disabled={busy} className="btn btn-acid !py-3">{busy ? "Addingâ€¦" : "Add"}</button>
        </form>
        {msg && <p className="mt-3 text-sm text-white/80">{msg}</p>}

        <ul className="mt-5 flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={row.id} className="grid gap-3 rounded-[1.5rem] border border-white/[0.06] p-4 sm:grid-cols-[1fr_1.5fr_90px_auto] sm:items-center">
              <input value={row.name} onChange={(e) => setRows((all) => all.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))} className="input !py-2.5" aria-label={`Category name ${i + 1}`} />
              <input value={row.description ?? ""} onChange={(e) => setRows((all) => all.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))} className="input !py-2.5" placeholder="Description" aria-label={`Category description ${i + 1}`} />
              <div className="text-xs text-fog text-center">{row.productCount ?? 0} items</div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => updateCategory(row)} className="btn btn-ghost !px-4 !py-2 !text-[12px]">Save</button>
                <button type="button" onClick={() => removeCategory(row)} className="btn btn-ghost !px-4 !py-2 !text-[12px] hover:!text-danger">Delete</button>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="rounded-[1.5rem] border border-white/[0.06] py-10 text-center text-sm text-fog">No categories yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function ProductEditor({
  initial,
  categories,
  onClose,
  onCategoriesChange,
}: {
  initial: AdminProduct | null;
  categories: AdminCategory[];
  onClose: (saved: boolean) => void;
  onCategoriesChange: (rows: AdminCategory[]) => void;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    brand: initial?.brand ?? "CLOTHING STORE",
    description: initial?.description ?? "",
    price: initial ? String(initial.price / 100) : "",
    salePrice: initial?.salePrice != null ? String(initial.salePrice / 100) : "",
    categoryId: initial?.category?.id ?? "",
    tags: initial?.tags.join(", ") ?? "",
    featured: initial?.featured ?? false,
    isNew: initial?.isNew ?? true,
    active: initial?.active ?? true,
  });
  const [images, setImages] = useState<string[]>(initial?.images.map((i) => i.url) ?? []);
  const [variants, setVariants] = useState<EditVariant[]>(
    initial
      ? initial.variants.map((v) => ({ size: v.size, colorName: v.colorName, colorHex: v.colorHex, stock: v.stock }))
      : [
          { size: "M", colorName: "Black", colorHex: "#141414", stock: 10 },
          { size: "L", colorName: "Black", colorHex: "#141414", stock: 10 },
        ]
  );
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [quickCategory, setQuickCategory] = useState("");
  const [quickCategoryBusy, setQuickCategoryBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploadErr("");
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setUploadErr(data.error ?? `Could not upload ${file.name}`);
          continue;
        }
        setImages((prev) => [...prev, data.path as string]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(idx: number) {
    const path = images[idx];
    setImages((prev) => prev.filter((_, i) => i !== idx));
    if (path.startsWith("/uploads/")) {
      await fetch("/api/admin/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      }).catch(() => {});
    }
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  const setVar = (i: number, patch: Partial<EditVariant>) =>
    setVariants((vs) => vs.map((v, x) => (x === i ? { ...v, ...patch } : v)));
  const addVariant = () =>
    setVariants((vs) => [...vs, { size: "", colorName: vs[0]?.colorName ?? "Black", colorHex: vs[0]?.colorHex ?? "#141414", stock: 0 }]);
  const removeVariant = (i: number) => setVariants((vs) => vs.filter((_, x) => x !== i));

  async function createQuickCategory() {
    if (!quickCategory.trim() || quickCategoryBusy) return;
    setQuickCategoryBusy(true);
    const name = quickCategory.trim();
    const { ok, data } = await api<{ category?: AdminCategory; error?: string }>("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name, description: "" }),
    });
    setQuickCategoryBusy(false);
    if (!ok || !data.category) {
      setErr(data.error ?? "Could not create category.");
      return;
    }
    const next = [...categories, data.category].sort((a, b) => a.name.localeCompare(b.name));
    onCategoriesChange(next);
    setF((s) => ({ ...s, categoryId: data.category!.id }));
    setQuickCategory("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");

    const cleanVariants = variants
      .map((v) => ({ ...v, size: v.size.trim().toUpperCase(), colorName: v.colorName.trim(), stock: Math.max(0, Math.floor(v.stock) || 0) }))
      .filter((v) => v.size && v.colorName);
    if (cleanVariants.length === 0) { setErr("Add at least one size + colour variant."); return; }
    if (images.length === 0) { setErr("Add at least one product photo."); return; }
    const pricePaise = Math.round(parseFloat(f.price) * 100);
    if (!pricePaise || pricePaise <= 0) { setErr("Enter a valid price in ₹."); return; }
    const salePaise = f.salePrice ? Math.round(parseFloat(f.salePrice) * 100) : null;
    if (salePaise != null && salePaise >= pricePaise) { setErr("Sale price must be lower than the regular price."); return; }

    const payload = {
      name: f.name.trim(),
      brand: f.brand.trim() || "CLOTHING STORE",
      description: f.description,
      price: pricePaise,
      salePrice: salePaise,
      categoryId: f.categoryId || null,
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 40),
      featured: f.featured,
      isNew: f.isNew,
      active: f.active,
      images,
      variants: cleanVariants,
    };

    setBusy(true);
    const { ok, data } = await api<{ error?: string }>("/api/admin/products", {
      method: initial ? "PUT" : "POST",
      body: JSON.stringify(initial ? { ...payload, id: initial.id } : payload),
    });
    setBusy(false);
    if (ok) onClose(true);
    else setErr(data.error ?? "Save failed.");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 pt-6 sm:pt-10" role="dialog" aria-modal="true" aria-label={initial ? "Edit product" : "New product"}>
      <div className="absolute inset-0 bg-black/75" style={{ backdropFilter: "blur(4px)" }} onClick={() => onClose(false)} />
      <form onSubmit={save} className="glass relative mb-10 w-full max-w-4xl overflow-hidden rounded-[2.2rem] bg-black/[0.98]">
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-7 py-5 sm:px-9">
          <div>
            <p className="kicker !text-sm">{initial ? "Editing" : "Creating"}</p>
            <h3 className="text-xl font-black tracking-tight">{initial ? initial.name : "New product"}</h3>
          </div>
          <button type="button" onClick={() => onClose(false)} aria-label="Close editor" className="grid size-10 place-items-center rounded-full border border-line text-fog transition hover:bg-white/10 hover:text-ivory">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="grid gap-8 px-7 py-7 sm:px-9 lg:grid-cols-[290px_1fr]">
          {/* ---------- photo manager ---------- */}
          <section aria-labelledby="ed-photos">
            <h4 id="ed-photos" className="text-sm font-black">Product photos</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-fog">Upload your authorised product shots. First image is the cover. Up to 24 photos per product, 5 MB each â€” JPG, PNG, WebP, GIF.</p>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-[1.4rem] border-2 border-dashed border-line bg-white/[0.02] px-4 py-8 text-center transition hover:border-acid/50 hover:bg-acid/[0.04]"
            >
              <span className={`grid size-11 place-items-center rounded-full bg-acid/15 text-acid ${uploading ? "animate-pulse-soft" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </span>
              <span className="text-[13px] font-bold">{uploading ? "Uploadingâ€¦" : "Upload photos"}</span>
              <span className="text-[11px] text-fog">click to browse your device</span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" aria-hidden onChange={(e) => uploadFiles(e.target.files)} />
            {uploadErr && <p role="alert" className="mt-2 text-xs font-semibold text-danger">{uploadErr}</p>}

            {images.length > 0 && (
              <ul className="mt-4 grid grid-cols-2 gap-2.5">
                {images.map((url, i) => (
                  <li key={url + i} className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border bg-charcoal ${i === 0 ? "col-span-2 border-acid/60" : "border-line"}`}>
                    <Image src={url} alt={`Product photo ${i + 1}`} fill sizes="(max-width:768px) 40vw, 260px" className="object-cover" unoptimized />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-acid px-2.5 py-0.5 text-[10px] font-bold text-acid-ink">COVER</span>}
                    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                      {i > 0 && (
                        <button type="button" onClick={() => moveImage(i, -1)} aria-label="Move earlier" title="Make cover / move up" className="grid size-7 place-items-center rounded-full bg-black/70 text-ivory">â†‘</button>
                      )}
                      {i < images.length - 1 && (
                        <button type="button" onClick={() => moveImage(i, 1)} aria-label="Move later" className="grid size-7 place-items-center rounded-full bg-black/70 text-ivory">â†“</button>
                      )}
                      <button type="button" onClick={() => removeImage(i)} aria-label={`Remove photo ${i + 1}`} className="grid size-7 place-items-center rounded-full bg-black/70 text-danger">
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <label className={LBL} htmlFor="p-imgurl">â€¦or add by URL</label>
              <div className="flex gap-1.5">
                <input id="p-imgurl" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://â€¦" className="input !py-2 !text-xs font-mono" />
                <button
                  type="button"
                  className="btn btn-ghost !px-3.5 !py-2 !text-[12px]"
                  onClick={() => { if (urlInput.trim()) { setImages((p) => [...p, urlInput.trim()]); setUrlInput(""); } }}
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          {/* ---------- core fields ---------- */}
          <section className="flex flex-col gap-4" aria-labelledby="ed-core">
            <h4 id="ed-core" className="text-sm font-black">Details &amp; pricing</h4>
            <div>
              <label className={LBL} htmlFor="p-name">Product name *</label>
              <input id="p-name" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="input" placeholder="Name it exactly how you want customers to see it" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LBL} htmlFor="p-brand">Brand</label>
                <input id="p-brand" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} className="input" placeholder="Any brand name you want" />
              </div>
              <div>
                <label className={LBL} htmlFor="p-cat">Category</label>
                <select id="p-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="input">
                  <option value="">â€” None / Uncategorised â€”</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="mt-2 flex gap-2">
                  <input
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    placeholder="Quick add category"
                    className="input !py-2.5 !text-sm"
                    aria-label="Quick add category"
                  />
                  <button type="button" onClick={createQuickCategory} disabled={quickCategoryBusy || !quickCategory.trim()} className="btn btn-ghost !px-4 !py-2.5 !text-[12px] whitespace-nowrap">
                    {quickCategoryBusy ? "Addingâ€¦" : "+ Add"}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LBL} htmlFor="p-price">Regular price (₹) *</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fog">₹</span>
                  <input id="p-price" required type="number" min={1} step="1" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className="input !pl-8 tabular-nums" placeholder="1299" />
                </div>
              </div>
              <div>
                <label className={LBL} htmlFor="p-sale">Sale price (₹) â€” optional</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fog">₹</span>
                  <input id="p-sale" type="number" min={0} step="1" inputMode="numeric" value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: e.target.value })} className="input !pl-8 tabular-nums" placeholder="999" />
                </div>
              </div>
            </div>
            <div>
              <label className={LBL} htmlFor="p-desc">Description</label>
              <textarea id="p-desc" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="input resize-none" placeholder="Write the product story, fabric details, fit, care, delivery notes â€” customers see this on the product page." />
            </div>
            <div>
              <label className={LBL} htmlFor="p-tags">Tags (comma separated)</label>
              <input id="p-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} className="input" placeholder="oversized, drop04, limited, winter, utility, premium â€¦ up to 40 tags" />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              {([["featured", "Show in Best sellers"], ["isNew", "Show in New arrivals"], ["active", "Visible in shop"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2.5 text-[13px] text-silver">
                  <input type="checkbox" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} className="size-4 accent-white" />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* ---------- variants editor ---------- */}
        <div className="border-t border-line px-7 py-7 sm:px-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black">Sizes &amp; colours</h4>
              <p className="mt-0.5 text-[11px] text-fog">One row per sellable combination. Any size label works â€” XSâ€¦XXL, 28â€“36, FREE, UK 9â€¦ Up to 200 variants per product.</p>
            </div>
            <button type="button" onClick={addVariant} className="btn btn-ghost !px-4 !py-2 !text-[12px]">+ Add variant</button>
          </div>

          <div className="mt-4 hidden grid-cols-[1fr_1.4fr_44px_110px_40px] gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fog sm:grid">
            <span>Size *</span><span>Colour *</span><span className="text-center">Swatch</span><span>Stock</span><span />
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {variants.map((v, i) => (
              <li key={i} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white/[0.02] p-2.5 sm:grid-cols-[1fr_1.4fr_44px_110px_40px] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-1">
                <input value={v.size} onChange={(e) => setVar(i, { size: e.target.value.toUpperCase() })} placeholder="M" maxLength={10} className="input !py-2.5 !text-sm" aria-label={`Size for variant ${i + 1}`} />
                <input value={v.colorName} onChange={(e) => setVar(i, { colorName: e.target.value })} placeholder="Black" maxLength={40} className="input !py-2.5 !text-sm" aria-label={`Colour for variant ${i + 1}`} />
                <div className="flex items-center justify-center">
                  <input type="color" value={v.colorHex} onChange={(e) => setVar(i, { colorHex: e.target.value })} className="size-9 cursor-pointer rounded-full border-2 border-line bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0" aria-label={`Swatch colour for variant ${i + 1}`} />
                </div>
                <input type="number" min={0} step={1} value={v.stock} onChange={(e) => setVar(i, { stock: parseInt(e.target.value) || 0 })} className="input !py-2.5 !text-sm tabular-nums" aria-label={`Stock for variant ${i + 1}`} />
                <button type="button" onClick={() => removeVariant(i)} disabled={variants.length === 1} aria-label={`Remove variant ${i + 1}`} className="grid size-9 place-items-center justify-self-end rounded-full border border-line text-fog transition hover:text-danger disabled:opacity-30">
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* footer */}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-white/[0.06] bg-black px-7 py-5 sm:px-9">
          <button type="submit" disabled={busy} className="btn btn-acid !px-8">
            {busy ? "Savingâ€¦" : initial ? "Save changes" : "Publish product"}
          </button>
          <button type="button" onClick={() => onClose(false)} className="btn btn-ghost">Cancel</button>
          <p className="text-[11px] text-fog">Customers see changes instantly â€” no limit on how many products you can add.</p>
          {err && <p role="alert" className="w-full rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{err}</p>}
        </div>
      </form>
    </div>
  );
}

export function ProductsPanel({ categories }: { categories: { id: string; name: string }[] }) {
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [editing, setEditing] = useState<AdminProduct | null | "new">(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [msg, setMsg] = useState("");
  const [localCategories, setLocalCategories] = useState<AdminCategory[]>(categories);

  const load = useCallback(async () => {
    const [{ ok, data }, cats] = await Promise.all([
      api<{ products: AdminProduct[] }>("/api/admin/products"),
      api<{ categories: AdminCategory[] }>("/api/admin/categories"),
    ]);
    if (ok) setItems(data.products);
    if (cats.ok) setLocalCategories(cats.data.categories);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function quickToggle(p: AdminProduct, field: "featured" | "isNew" | "active") {
    await api("/api/admin/products", {
      method: "PUT",
      body: JSON.stringify({
        id: p.id, name: p.name, description: p.description, brand: p.brand, price: p.price, salePrice: p.salePrice,
        categoryId: p.category?.id ?? null, tags: p.tags,
        active: field === "active" ? !p.active : p.active,
        featured: field === "featured" ? !p.featured : p.featured,
        isNew: field === "isNew" ? !p.isNew : p.isNew,
        images: p.images.map((i) => i.url),
        variants: p.variants.map((v) => ({ size: v.size, colorName: v.colorName, colorHex: v.colorHex, stock: v.stock })),
      }),
    });
    load();
  }

  async function remove(p: AdminProduct) {
    if (!confirm(`Delete "${p.name}" permanently? Past orders keep their item snapshots.`)) return;
    const { ok } = await api(`/api/admin/products?id=${p.id}`, { method: "DELETE" });
    setMsg(ok ? `Deleted "${p.name}".` : "Delete failed.");
    load();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fog">
          <span className="font-bold text-ivory tabular-nums">{items?.length ?? "â€¦"}</span> products · unlimited catalogue · <span className="font-semibold">{localCategories.length}</span> categories
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setManagingCategories(true)} className="btn btn-ghost !px-5 !py-3 !text-[13px]">Manage categories</button>
          <button onClick={() => setEditing("new")} className="btn btn-acid !px-6 !py-3 !text-[13px]">
            + New product
          </button>
        </div>
      </div>
      {msg && <p className="mb-4 text-sm text-acid">{msg}</p>}

      {!items ? (
        <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" aria-busy="true" />
      ) : items.length === 0 ? (
        <div className="surface-card grid place-items-center gap-4 rounded-[2rem] py-20 text-center">
          <p className="font-bold">No products yet</p>
          <p className="max-w-xs text-sm text-fog">Create your first product â€” upload photos, set pricing, define sizes and colours.</p>
          <button onClick={() => setEditing("new")} className="btn btn-acid">Create product</button>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((p) => {
            const stock = p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <li key={p.id} className="surface-card flex flex-wrap items-center gap-4 !rounded-[1.8rem] p-4 transition hover:border-white/15">
                <span className="relative block size-16 shrink-0 overflow-hidden rounded-2xl bg-charcoal sm:size-[4.5rem]">
                  {p.images[0] && <Image src={p.images[0].url} alt={p.name} fill sizes="72px" className="object-cover" unoptimized={p.images[0].url.startsWith("/uploads/")} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.name}</p>
                  <p className="mt-0.5 text-xs text-fog">
                    {p.category?.name ?? "Uncategorised"} · {p.variants.length} variant{p.variants.length === 1 ? "" : "s"} ·{" "}
                    <span className={stock === 0 ? "font-semibold text-danger" : ""}>stock {stock}</span> ·{" "}
                    <span className="tabular-nums text-silver">{formatINR(p.salePrice ?? p.price)}</span>
                    {p.salePrice != null && <span className="line-through opacity-60"> {formatINR(p.price)}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => quickToggle(p, "active")} className="chip !text-[11px]" data-active={p.active} title="Visible in shop">{p.active ? "Live" : "Hidden"}</button>
                  <button onClick={() => quickToggle(p, "featured")} className="chip !text-[11px]" data-active={p.featured}>Featured</button>
                  <button onClick={() => quickToggle(p, "isNew")} className="chip !text-[11px]" data-active={p.isNew}>New</button>
                  <button
                    onClick={async () => {
                      const { ok, data } = await api<{ error?: string }>("/api/admin/products", {
                        method: "POST",
                        body: JSON.stringify({ action: "duplicate", id: p.id }),
                      });
                      setMsg(ok ? `Duplicated â€œ${p.name}â€ as draft.` : (data.error ?? "Duplicate failed."));
                      if (ok) load();
                    }}
                    className="btn btn-ghost !px-4 !py-2 !text-[12px]"
                  >
                    Duplicate
                  </button>
                  <button onClick={() => setEditing(p)} className="btn btn-ghost !px-4 !py-2 !text-[12px]">Edit</button>
                  <button onClick={() => remove(p)} className="btn btn-ghost !px-4 !py-2 !text-[12px] hover:!text-danger">Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ProductEditor
          initial={editing === "new" ? null : editing}
          categories={localCategories}
          onCategoriesChange={setLocalCategories}
          onClose={(saved) => {
            setEditing(null);
            if (saved) load();
          }}
        />
      )}

      {managingCategories && (
        <CategoryManager
          categories={localCategories}
          onChanged={setLocalCategories}
          onClose={() => setManagingCategories(false)}
        />
      )}
    </div>
  );
}

/* ============================== ORDERS ============================== */

type AdminOrder = {
  id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string;
  subtotal: number; discount: number; shippingFee: number; total: number; couponCode: string | null;
  email: string; phone: string; shippingName: string; trackingNumber: string | null; notes: string | null;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  createdAt: string;
  items: { id: string; productName: string; size: string; color: string; qty: number; price: number }[];
  payments: { id: string; status: string; providerOrderId: string | null; providerPaymentId: string | null }[];
};

const STATUSES = Object.keys(ORDER_STATUS_LABELS);

export function OrdersPanel() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { ok, data } = await api<{ orders: AdminOrder[] }>("/api/admin/orders");
    if (ok) setOrders(data.orders);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setStatus(o: AdminOrder, status: string) {
    const { ok, data } = await api<{ error?: string }>("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: o.id, status }) });
    setMsg(ok ? `${o.orderNumber} â†’ ${ORDER_STATUS_LABELS[status]}` : (data.error ?? "Failed"));
    load();
  }

  async function setTracking(o: AdminOrder, trackingNumber: string) {
    await api("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: o.id, trackingNumber }) });
    setMsg(`Tracking updated for ${o.orderNumber}`);
    load();
  }

  if (!orders) return <div className="h-64 animate-pulse-soft rounded-[2rem] bg-white/5" aria-busy="true" />;

  return (
    <div>
      {msg && <p className="mb-4 text-sm text-acid">{msg}</p>}
      {orders.length === 0 && <p className="surface-card rounded-[2rem] py-16 text-center text-sm text-fog">No orders yet.</p>}
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.id} className="surface-card !rounded-[1.8rem] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => setOpenId(openId === o.id ? null : o.id)} className="text-left" aria-expanded={openId === o.id}>
                <p className="font-bold">{o.orderNumber} <span className="text-fog">·</span> <span className="font-editorial italic font-normal text-fog">{o.shippingName}</span></p>
                <p className="text-xs text-fog">
                  {new Date(o.createdAt).toLocaleString("en-IN")} · {o.items.reduce((s, i) => s + i.qty, 0)} items ·{" "}
                  {o.paymentMethod === "cod" ? "COD" : "Online"} · payment {o.paymentStatus}
                </p>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold tabular-nums">{formatINR(o.total)}</span>
                <label className="sr-only" htmlFor={`st-${o.id}`}>Order status</label>
                <select
                  id={`st-${o.id}`}
                  value={o.status}
                  onChange={(e) => setStatus(o, e.target.value)}
                  className="input !w-auto !py-2 !text-[12px]"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            {openId === o.id && (
              <div className="mt-5 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Items</p>
                  <ul className="mt-2 flex flex-col gap-1.5 text-sm text-silver">
                    {o.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-3">
                        <span>{i.productName} â€” {i.size}/{i.color} ×{i.qty}</span>
                        <span className="tabular-nums">{formatINR(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-fog">
                    Subtotal {formatINR(o.subtotal)} · Discount âˆ’{formatINR(o.discount)}{o.couponCode ? ` (${o.couponCode})` : ""} · Shipping {formatINR(o.shippingFee)}
                  </p>
                  {o.notes && <p className="mt-2 rounded-2xl bg-white/[0.03] p-3 text-xs text-fog">Note: {o.notes}</p>}
                </div>
                <div className="text-sm text-silver">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fog">Deliver to</p>
                  <p className="mt-2">{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}, {o.address.city}, {o.address.state} â€” {o.address.pincode}</p>
                  <p className="mt-1 text-xs text-fog">{o.phone} · {o.email}</p>
                  <p className="mt-1 text-[10px] text-fog">Customer-confirmed · Not SMS verified</p>
                  {o.payments[0]?.providerOrderId && (
                    <p className="mt-2 text-xs text-fog">Razorpay order: <code className="text-[11px]">{o.payments[0].providerOrderId}</code>{o.payments[0].providerPaymentId && <> · payment: <code className="text-[11px]">{o.payments[0].providerPaymentId}</code></>}</p>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <label className="sr-only" htmlFor={`tr-${o.id}`}>Tracking number</label>
                    <input id={`tr-${o.id}`} defaultValue={o.trackingNumber ?? ""} placeholder="Tracking number" className="input !py-2 !text-[12px]" onBlur={(e) => e.target.value !== (o.trackingNumber ?? "") && setTracking(o, e.target.value)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.status !== "cancelled" && o.status !== "delivered" && (
                      <button onClick={() => confirm(`Cancel ${o.orderNumber}? Stock will be restored.`) && setStatus(o, "cancelled")} className="btn btn-ghost !py-2 !text-[12px] hover:!text-danger">Cancel + restock</button>
                    )}
                    {o.paymentStatus === "paid" && o.status !== "refunded" && (
                      <button onClick={() => confirm(`Mark ${o.orderNumber} as refunded? Stock will be restored. Process the actual refund in your Razorpay dashboard.`) && setStatus(o, "refunded")} className="btn btn-ghost !py-2 !text-[12px] hover:!text-danger">Mark refunded</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

