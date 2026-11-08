import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import {
  getSetting,
  getSettingRaw,
  DEFAULT_HERO,
  DEFAULT_PROMO,
  DEFAULT_SOCIAL,
  DEFAULT_CONTACT,
  DEFAULT_SHIPPING,
  DEFAULT_TESTIMONIALS,
  type HeroSettings,
  type PromoSettings,
  type SocialSettings,
  type ContactSettings,
  type ShippingSettings,
  type Testimonial,
} from "@/lib/settings";
import { DEFAULT_HOMEPAGE_SECTIONS, type HomepageSections } from "@/lib/homepage-sections";
import { AdminShell } from "@/components/admin-client";

export const metadata: Metadata = { title: "Admin Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = ["overview", "products", "orders", "delivery", "customers", "coupons", "inventory", "reviews", "content"] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();

  if (!admin) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 pt-24">
        <div className="surface-card w-full rounded-[2rem] p-10 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger/10 text-danger">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7"/></svg>
          </span>
          <h1 className="mt-4 text-2xl font-black">Restricted area</h1>
          <p className="mt-2 text-sm text-fog">The admin dashboard requires an administrator account. Customers cannot access this area.</p>
          <Link href="/account" className="btn btn-acid mt-6 w-full">Sign in</Link>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";

  const cats = await db.select().from(categories).orderBy(categories.sort);
  const settings = {
    hero: await getSetting<HeroSettings>("hero", DEFAULT_HERO),
    promo: await getSetting<PromoSettings>("promo", DEFAULT_PROMO),
    social: await getSetting<SocialSettings>("social", DEFAULT_SOCIAL),
    contact: await getSetting<ContactSettings>("contact", DEFAULT_CONTACT),
    shipping: await getSetting<ShippingSettings>("shipping", DEFAULT_SHIPPING),
    testimonials: await getSettingRaw<Testimonial[]>("testimonials", DEFAULT_TESTIMONIALS),
    homepageSections: await getSetting<HomepageSections>("homepage_sections", DEFAULT_HOMEPAGE_SECTIONS),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-32 sm:px-6">
      <div className="relative overflow-hidden rounded-[3rem] border border-white/[0.04] bg-black px-8 py-12 sm:px-16">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-[500px] rounded-full bg-white/[0.02] blur-[120px]" />
        
        <div className="relative flex flex-wrap items-center justify-between gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-white/10 p-1">
                <div className="relative h-full w-full overflow-hidden rounded-full ring-2 ring-acid/40">
                  <Image src="/logo.svg" alt="FC" fill sizes="56px" className="object-cover" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-acid">Command Center</p>
                <h1 className="mt-1 text-4xl font-black tracking-tighter sm:text-5xl">
                  Studio <span className="font-editorial italic font-normal text-fog/60">Manager</span>
                </h1>
              </div>
            </div>
            
            <p className="max-w-lg text-lg font-medium leading-relaxed text-fog/60">
              Manage your products, orders and store from one unified dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/admin?tab=products" className="btn btn-acid !px-8 !py-4 !text-xs font-black uppercase tracking-widest shadow-2xl shadow-white/10 transition-transform hover:scale-105">+ Create Drop</Link>
            <Link href="/" className="btn btn-ghost glass !px-8 !py-4 !text-xs font-black uppercase tracking-widest">Live View</Link>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 border-t border-white/[0.03] pt-6">
          <span className="size-1.5 rounded-full bg-acid animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
            Authenticated as <span className="text-white/60">{admin.email}</span>
          </p>
        </div>
      </div>

      <nav aria-label="Admin sections" className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link key={t} href={`/admin?tab=${t}`} className="chip capitalize" data-active={tab === t} aria-current={tab === t ? "page" : undefined}>
            {t}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <AdminShell tab={tab} categories={cats.map((c) => ({ id: c.id, name: c.name }))} settings={settings} />
      </div>
    </div>
  );
}


