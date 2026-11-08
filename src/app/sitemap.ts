import type { MetadataRoute } from "next";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  let productUrls: MetadataRoute.Sitemap = [];

  try {
    const rows = await db
      .select({ slug: products.slug })
      .from(products)
      .where(eq(products.active, true));

    productUrls = rows.map((product) => ({
      url: `${base}/product/${product.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // The sitemap can still include public pages if the database is unavailable.
  }

  return [
    {
      url: base,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/shop`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...["shipping", "returns", "privacy", "terms"].map((document) => ({
      url: `${base}/legal/${document}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
    ...productUrls,
  ];
}
