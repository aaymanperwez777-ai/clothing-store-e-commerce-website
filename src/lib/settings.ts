import "server-only";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type ShippingSettings = { fee: number; freeOver: number; codEnabled: boolean; estimate: string };
export type HeroSettings = { title: string; subtitle: string; kicker: string; image: string; cta: string };
export type PromoSettings = { enabled: boolean; text: string; cta: string; href: string };
export type SocialSettings = { instagram: string; instagramImages: { url: string; alt: string }[] };
export type ContactSettings = { email: string; phone: string; address: string; city: string };
export type Testimonial = { name: string; location: string; quote: string; rating: number };

export const DEFAULT_SHIPPING: ShippingSettings = {
  fee: 9900,
  freeOver: 149900,
  codEnabled: true,
  estimate: "3–6 business days across India",
};

export const DEFAULT_HERO: HeroSettings = {
  kicker: "Everyday fashion · Made for everyone",
  title: "STYLE YOUR WAY",
  subtitle: "Explore everyday clothing, carefully selected styles and collections for every occasion.",
  image: "/images/hero.jpg",
  cta: "Shop new arrivals",
};

export const DEFAULT_PROMO: PromoSettings = {
  enabled: true,
  text: "Festive drop — extra 10% off with code WELCOME10",
  cta: "Shop the drop",
  href: "/shop",
};

export const DEFAULT_SOCIAL: SocialSettings = {
  instagram: "",
  instagramImages: [],
};

export const DEFAULT_CONTACT: ContactSettings = {
  email: "hello@example.com",
  phone: "",
  address: "Demo store — configure before launch",
  city: "India",
};

export const DEFAULT_TESTIMONIALS: Testimonial[] = [];

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    if (!rows[0]) return fallback;
    return { ...fallback, ...(rows[0].value as object) } as T;
  } catch {
    return fallback;
  }
}

export async function getSettingRaw<T>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db.select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
    return rows[0] ? (rows[0].value as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(siteSettings)
    .values({ key, value: value as object, updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: value as object, updatedAt: new Date() } });
}
