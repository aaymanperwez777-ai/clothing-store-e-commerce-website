/**
 * CLOTHING STORE — database seed (development/sandbox).
 * 50 products across 5 categories with randomized pricing, variants and stock.
 * Run:  npx tsx scripts/seed.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, pool } from "../src/db";
import {
  users, categories, products, productImages, productVariants, coupons,
  siteSettings, carts, cartItems, orders, orderItems, payments, sessions,
  addresses, wishlists, reviews, notifications, newsletterSubscribers,
  inventoryTransactions, passwordResets,
} from "../src/db/schema";
import { getTableConfig } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

const isProd = process.env.NODE_ENV === "production";
const confirmDestructive = process.argv.includes("--confirm-destructive");

const PX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;

async function wipe() {
  const tables = [
    notifications, payments, orderItems, orders, inventoryTransactions, cartItems, carts,
    wishlists, reviews, addresses, passwordResets, sessions, productImages, productVariants,
    products, categories, coupons, newsletterSubscribers, siteSettings, users,
  ];
  for (const t of tables) {
    const { name } = getTableConfig(t);
    await db.execute(sql.raw(`TRUNCATE TABLE "${name}" RESTART IDENTITY CASCADE`));
  }
}

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[rand(0, arr.length - 1)]; }

// ──────────────── Product Images ────────────────
// Map to our local generated images (cycle through 8 product shots)
const LOCAL_IMAGES = [
  "/images/products/tee-black.jpg",
  "/images/products/hoodie-acid.jpg",
  "/images/products/cargo-olive.jpg",
  "/images/products/tee-graphic.jpg",
  "/images/products/puffer-black.jpg",
  "/images/products/denim-wide.jpg",
  "/images/products/cap-snap.jpg",
  "/images/products/sweat-cream.jpg",
];

// Full body models for the 3D ring carousel (first 6 products)
const A = "https://reel-ref-try-the-look.vercel.app/assets/";
const MODEL_IMAGES = [
  A + "model-1-640.webp",
  A + "model-5-640.webp",
  A + "model-4-640.webp",
  A + "model-6-640.webp",
  A + "model-3-640.webp",
  A + "model-2-640.webp",
];

// ──────────────── Color palette ────────────────
const COLORS: [string, string][] = [
  ["Black", "#0a0a0a"], ["Jet Black", "#111111"], ["Charcoal", "#333333"],
  ["White", "#f5f5f5"], ["Off-White", "#e8e4dc"], ["Cream", "#e9e2d2"],
  ["Olive", "#4a5130"], ["Sage", "#6b7c5e"], ["Forest", "#2d3b24"],
  ["Navy", "#1a2340"], ["Indigo", "#2c3a56"], ["Midnight", "#0d1525"],
  ["Stone", "#8f8578"], ["Sand", "#b5a896"], ["Taupe", "#7a6e62"],
  ["Burgundy", "#5c1a2a"], ["Rust", "#8b3a1d"], ["Clay", "#a0735e"],
  ["Washed Grey", "#6b6b6b"], ["Slate", "#4a4a52"], ["Ash", "#888888"],
];

const SIZES_APPAREL = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZES_BOTTOMS = ["28", "30", "32", "34", "36"];
const SIZES_ONESIZE = ["FREE"];

// ──────────────── 50 Product Definitions ────────────────
type ProdDef = {
  name: string; cat: string; price: number; sale: number | null;
  desc: string; tags: string[]; featured: boolean; isNew: boolean;
  sizeType: "apparel" | "bottoms" | "onesize"; colorCount: number;
};

const PRODUCTS: ProdDef[] = [
  // ─── T-SHIRTS (15) ───
  { name: "Obsidian Oversized Tee", cat: "t-shirts", price: 129900, sale: 99900, desc: "300 GSM heavyweight cotton jersey. Dropped shoulders, boxy oversized unisex fit. Bio-washed and pre-shrunk.", tags: ["oversized","basic","heavyweight"], featured: true, isNew: true, sizeType: "apparel", colorCount: 3 },
  { name: "Shadow Drop Tee", cat: "t-shirts", price: 119900, sale: null, desc: "240 GSM compact cotton with a subtle tonal shadow print. Relaxed fit, ribbed collar.", tags: ["tonal","minimal"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Graphic Print Tee", cat: "t-shirts", price: 149900, sale: 119900, desc: "Screen-printed statement graphic on boxy canvas. Limited run — no restock.", tags: ["graphic","limited","drop04"], featured: true, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Essential Box Fit Tee", cat: "t-shirts", price: 99900, sale: null, desc: "The everyday staple. 200 GSM ringspun cotton, clean finish, true box fit.", tags: ["essential","basic"], featured: false, isNew: false, sizeType: "apparel", colorCount: 4 },
  { name: "Concrete Washed Tee", cat: "t-shirts", price: 139900, sale: 109900, desc: "Garment-washed for a broken-in texture from day one. 280 GSM sun-faded finish.", tags: ["washed","vintage"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Raw Edge Split Hem Tee", cat: "t-shirts", price: 134900, sale: null, desc: "Raw-cut side splits for movement. Heavyweight cotton, elongated drop tail.", tags: ["raw","elongated"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Embroidered Logo Tee", cat: "t-shirts", price: 144900, sale: 124900, desc: "Tonal chain-stitch FC monogram on the chest. 260 GSM combed cotton.", tags: ["embroidered","logo"], featured: true, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Bleach Splash Tee", cat: "t-shirts", price: 159900, sale: null, desc: "Hand-bleached one-of-one patterns. No two pieces are alike.", tags: ["bleach","handmade","unique"], featured: false, isNew: true, sizeType: "apparel", colorCount: 1 },
  { name: "Ribbed Mock Neck Tee", cat: "t-shirts", price: 119900, sale: null, desc: "Structured mock neckline with fine rib texture. 220 GSM fitted unisex.", tags: ["mockneck","ribbed"], featured: false, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Layered Mesh Panel Tee", cat: "t-shirts", price: 169900, sale: 149900, desc: "Contrast mesh side panels for breathability. Technical streetwear hybrid.", tags: ["mesh","tech","panel"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Pigment Dye Pocket Tee", cat: "t-shirts", price: 129900, sale: null, desc: "Pigment-dyed for a chalky matte finish. Single chest pocket, boxy cut.", tags: ["pigment","pocket"], featured: false, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Retro Stripe Ringer Tee", cat: "t-shirts", price: 114900, sale: null, desc: "Contrast collar and cuff stripes on heavyweight cotton. 70s-inspired streetwear.", tags: ["retro","stripe","ringer"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Distressed Longline Tee", cat: "t-shirts", price: 154900, sale: 134900, desc: "Deliberately distressed hems and seams. Longline silhouette with side slits.", tags: ["distressed","longline"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Heavyweight Cropped Tee", cat: "t-shirts", price: 109900, sale: null, desc: "Cropped boxy fit hitting just above the waist. 300 GSM heavyweight cotton.", tags: ["cropped","boxy"], featured: false, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "FC All-Over Print Tee", cat: "t-shirts", price: 179900, sale: 159900, desc: "Sublimation all-over FC pattern on premium polyester-cotton blend.", tags: ["allover","print","statement"], featured: true, isNew: true, sizeType: "apparel", colorCount: 1 },

  // ─── HOODIES & SWEATSHIRTS (10) ───
  { name: "Acid Wash Heavy Hoodie", cat: "hoodies-sweatshirts", price: 289900, sale: 249900, desc: "400 GSM brushed fleece, acid-washed one-of-one finish. Kangaroo pocket + phone sleeve.", tags: ["hoodie","acidwash","heavyweight"], featured: true, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Cloud Crewneck Sweatshirt", cat: "hoodies-sweatshirts", price: 189900, sale: 169900, desc: "350 GSM loopback French terry. Garment-dyed ecru with ribbed cuffs and hem.", tags: ["crewneck","terry","soft"], featured: true, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Zip-Through Track Hoodie", cat: "hoodies-sweatshirts", price: 259900, sale: null, desc: "Full-zip track hoodie with contrast piping. 360 GSM cotton-poly fleece.", tags: ["zip","track","hoodie"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Oversized Balaclava Hoodie", cat: "hoodies-sweatshirts", price: 319900, sale: 289900, desc: "Integrated balaclava hood for full coverage. Heavyweight 420 GSM fleece.", tags: ["balaclava","oversized","statement"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Washed Raglan Sweatshirt", cat: "hoodies-sweatshirts", price: 199900, sale: null, desc: "Raglan sleeves for range of motion. Garment-washed for a lived-in feel.", tags: ["raglan","washed"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Cutoff Gym Hoodie", cat: "hoodies-sweatshirts", price: 219900, sale: 189900, desc: "Raw-cut sleeves and side splits. 320 GSM terry — gym-to-street hybrid.", tags: ["cutoff","gym","raw"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Embossed Logo Pullover", cat: "hoodies-sweatshirts", price: 249900, sale: null, desc: "Tone-on-tone embossed FC branding. Premium 380 GSM fleece, oversized fit.", tags: ["embossed","logo","premium"], featured: false, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Half-Zip Fleece Pullover", cat: "hoodies-sweatshirts", price: 269900, sale: 239900, desc: "Quarter-zip neckline with brushed sherpa lining. Windproof and cloud-warm.", tags: ["halfzip","fleece","sherpa"], featured: true, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Thermal Waffle Henley", cat: "hoodies-sweatshirts", price: 174900, sale: null, desc: "Waffle-knit thermal with a three-button henley neckline. Layering essential.", tags: ["thermal","waffle","henley"], featured: false, isNew: false, sizeType: "apparel", colorCount: 3 },
  { name: "Patch Pocket Overshirt", cat: "hoodies-sweatshirts", price: 229900, sale: null, desc: "Heavyweight cotton overshirt with dual patch pockets. Wear it open or buttoned.", tags: ["overshirt","layer","pocket"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },

  // ─── BOTTOMS (12) ───
  { name: "Utility Cargo Pants", cat: "bottoms", price: 199900, sale: null, desc: "Wide-leg cargos with six pockets. Ripstop cotton, adjustable drawcord hem.", tags: ["cargo","utility","wide-leg"], featured: true, isNew: true, sizeType: "bottoms", colorCount: 3 },
  { name: "Wide-Leg Indigo Denim", cat: "bottoms", price: 229900, sale: null, desc: "12 oz rigid indigo denim, baggy fit, stacked at the hem.", tags: ["denim","baggy","indigo"], featured: false, isNew: false, sizeType: "bottoms", colorCount: 2 },
  { name: "Relaxed Chino Trouser", cat: "bottoms", price: 179900, sale: 159900, desc: "Soft-washed cotton twill chino with a relaxed straight leg.", tags: ["chino","relaxed","trouser"], featured: false, isNew: true, sizeType: "bottoms", colorCount: 3 },
  { name: "Parachute Nylon Pant", cat: "bottoms", price: 209900, sale: null, desc: "Lightweight ripstop nylon with toggle hem. Elastic waist, deep side pockets.", tags: ["parachute","nylon","toggle"], featured: false, isNew: true, sizeType: "bottoms", colorCount: 2 },
  { name: "Washed Black Slim Jean", cat: "bottoms", price: 219900, sale: 189900, desc: "Washed black stretch denim with a slim tapered leg. 11 oz comfort-stretch.", tags: ["slim","washed","denim"], featured: false, isNew: false, sizeType: "bottoms", colorCount: 1 },
  { name: "Double Knee Work Pant", cat: "bottoms", price: 249900, sale: null, desc: "Reinforced double-knee canvas work pant. Straight fit, built for abuse.", tags: ["workwear","doubleknee","canvas"], featured: false, isNew: false, sizeType: "bottoms", colorCount: 2 },
  { name: "Fleece Jogger Pant", cat: "bottoms", price: 169900, sale: 149900, desc: "360 GSM brushed fleece joggers with ribbed cuffs. Zip side pockets.", tags: ["jogger","fleece","comfort"], featured: false, isNew: true, sizeType: "apparel", colorCount: 3 },
  { name: "Pleated Wide Trouser", cat: "bottoms", price: 239900, sale: null, desc: "Single front pleat on a wide-leg silhouette. Crisp cotton-poly blend.", tags: ["pleated","wide","tailored"], featured: false, isNew: false, sizeType: "bottoms", colorCount: 2 },
  { name: "Corduroy Carpenter Pant", cat: "bottoms", price: 219900, sale: 199900, desc: "8-wale corduroy with carpenter loops and a hammer pocket. Relaxed straight fit.", tags: ["corduroy","carpenter"], featured: true, isNew: true, sizeType: "bottoms", colorCount: 2 },
  { name: "Track Pant with Side Stripe", cat: "bottoms", price: 159900, sale: null, desc: "Retro track pant with contrast side stripes and snap button calves.", tags: ["track","stripe","snap"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Heavyweight Sweat Short", cat: "bottoms", price: 139900, sale: 119900, desc: "Raw-hem sweat shorts in 340 GSM terry. Above-the-knee length.", tags: ["shorts","raw","summer"], featured: false, isNew: true, sizeType: "apparel", colorCount: 3 },
  { name: "Mesh Basketball Short", cat: "bottoms", price: 129900, sale: null, desc: "Lightweight mesh shorts with embroidered logo. Elastic waist, side pockets.", tags: ["mesh","basketball","sport"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },

  // ─── JACKETS (6) ───
  { name: "Midnight Cropped Puffer", cat: "jackets", price: 399900, sale: 349900, desc: "Recycled poly fill, gloss nylon shell, funnel neck. Cropped boxy fit.", tags: ["puffer","cropped","winter"], featured: true, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "Oversized Denim Jacket", cat: "jackets", price: 329900, sale: null, desc: "14 oz raw selvedge denim jacket. Oversized box fit, copper hardware.", tags: ["denim","oversized","selvedge"], featured: false, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Coaches Windbreaker", cat: "jackets", price: 249900, sale: 219900, desc: "Lightweight nylon coaches jacket with snap-front closure. Mesh-lined.", tags: ["coaches","windbreaker","light"], featured: false, isNew: true, sizeType: "apparel", colorCount: 3 },
  { name: "Sherpa Lined Trucker", cat: "jackets", price: 379900, sale: null, desc: "Washed denim trucker with full sherpa fleece lining. Vintage fit.", tags: ["trucker","sherpa","warm"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },
  { name: "MA-1 Bomber Jacket", cat: "jackets", price: 359900, sale: 319900, desc: "Classic MA-1 silhouette in matte nylon. Ribbed collar, cuffs and hem.", tags: ["bomber","MA1","flight"], featured: true, isNew: true, sizeType: "apparel", colorCount: 2 },
  { name: "Anorak Half-Zip Shell", cat: "jackets", price: 299900, sale: null, desc: "Waterproof half-zip anorak with kangaroo pocket. Packable into its own pouch.", tags: ["anorak","halfzip","waterproof"], featured: false, isNew: false, sizeType: "apparel", colorCount: 2 },

  // ─── ACCESSORIES (7) ───
  { name: "FC Snapback Cap", cat: "accessories", price: 89900, sale: null, desc: "Structured six-panel snapback with flat brim and 3D FC monogram.", tags: ["cap","snapback"], featured: false, isNew: true, sizeType: "onesize", colorCount: 3 },
  { name: "Embroidered Bucket Hat", cat: "accessories", price: 99900, sale: null, desc: "Cotton twill bucket hat with embroidered logo. Reversible to solid black.", tags: ["bucket","hat","reversible"], featured: false, isNew: true, sizeType: "onesize", colorCount: 2 },
  { name: "Knit Beanie", cat: "accessories", price: 69900, sale: null, desc: "Ribbed acrylic-wool blend beanie. Cuff-fold fit, one size.", tags: ["beanie","winter","knit"], featured: false, isNew: false, sizeType: "onesize", colorCount: 3 },
  { name: "Canvas Tote Bag", cat: "accessories", price: 79900, sale: null, desc: "12 oz canvas tote with screen-printed FC graphic. Inner zip pocket.", tags: ["tote","bag","canvas"], featured: false, isNew: true, sizeType: "onesize", colorCount: 2 },
  { name: "Woven Belt", cat: "accessories", price: 59900, sale: null, desc: "Nylon webbing belt with matte black D-ring buckle. Adjustable, one size.", tags: ["belt","nylon","webbing"], featured: false, isNew: false, sizeType: "onesize", colorCount: 2 },
  { name: "Crew Sock 3-Pack", cat: "accessories", price: 49900, sale: null, desc: "Mid-calf cotton-blend crew socks. Jacquard FC logo. Pack of 3 pairs.", tags: ["socks","pack","crew"], featured: false, isNew: false, sizeType: "onesize", colorCount: 1 },
  { name: "Phone Crossbody Bag", cat: "accessories", price: 119900, sale: 99900, desc: "Compact nylon crossbody for phone, keys, wallet. Adjustable strap, zip closure.", tags: ["bag","crossbody","phone"], featured: false, isNew: true, sizeType: "onesize", colorCount: 2 },
];

async function main() {
  if (isProd) {
    console.error("❌ ERROR: Seed script is NOT allowed to run in production.");
    process.exit(1);
  }

  if (!ADMIN_PASSWORD || !DEMO_PASSWORD) {
    console.error("❌ ERROR: ADMIN_PASSWORD and DEMO_PASSWORD must be configured in environment variables.");
    process.exit(1);
  }

  if (!confirmDestructive) {
    console.error("❌ ERROR: This script will wipe your database tables.");
    console.error("   Run with '--confirm-destructive' to proceed.");
    process.exit(1);
  }

  console.log("→ Wiping existing data…");
  await wipe();

  console.log("→ Creating users…");
  await db.insert(users).values({
    name: "Store Owner", email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: "admin",
  });
  await db.insert(users).values({
    name: "Demo Customer", email: DEMO_EMAIL, phone: "9876543210",
    passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12), role: "customer",
  });

  console.log("→ Creating categories…");
  const catDefs = [
    { name: "T-Shirts", slug: "t-shirts", image: "/images/products/tee-graphic.jpg", sort: 1 },
    { name: "Hoodies & Sweatshirts", slug: "hoodies-sweatshirts", image: "/images/products/hoodie-acid.jpg", sort: 2 },
    { name: "Bottoms", slug: "bottoms", image: "/images/products/cargo-olive.jpg", sort: 3 },
    { name: "Jackets", slug: "jackets", image: "/images/products/puffer-black.jpg", sort: 4 },
    { name: "Accessories", slug: "accessories", image: "/images/products/cap-snap.jpg", sort: 5 },
  ];
  const catRows = await db.insert(categories).values(
    catDefs.map((c) => ({ ...c, description: `${c.name} — premium unisex fits by CLOTHING STORE.` }))
  ).returning();
  const catId = (slug: string) => catRows.find((c) => c.slug === slug)!.id;

  console.log(`→ Creating ${PRODUCTS.length} products…`);
  let count = 0;
  for (const def of PRODUCTS) {
    const slug = slugify(def.name) + "-" + Math.random().toString(36).slice(2, 6);
    const image = count < 6 ? MODEL_IMAGES[count] : LOCAL_IMAGES[count % LOCAL_IMAGES.length];

    const [p] = await db.insert(products).values({
      name: def.name,
      slug,
      description: def.desc,
      price: def.price,
      salePrice: def.sale,
      categoryId: catId(def.cat),
      tags: def.tags,
      featured: def.featured,
      isNew: def.isNew,
      active: true,
    }).returning();

    await db.insert(productImages).values([{ productId: p.id, url: image, alt: def.name, sort: 0 }]);

    // Pick random colors for this product
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5).slice(0, def.colorCount);
    const sizes = def.sizeType === "bottoms" ? SIZES_BOTTOMS
      : def.sizeType === "onesize" ? SIZES_ONESIZE
      : SIZES_APPAREL;

    // Pick a subset of sizes (not all, for variety)
    const sizeSubset = def.sizeType === "onesize"
      ? sizes
      : sizes.filter(() => Math.random() > 0.25); // ~75% of sizes

    for (const [colorName, colorHex] of shuffledColors) {
      for (const size of sizeSubset) {
        const stock = rand(0, 25);
        const skuBase = slugify(def.name).split("-").map(w => w[0]).join("").toUpperCase().slice(0, 5);
        const sku = `FC-${skuBase}-${colorName.slice(0, 3).toUpperCase()}-${size}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const [v] = await db.insert(productVariants).values({
          productId: p.id, size, colorName, colorHex, sku, stock,
        }).returning();
        if (stock > 0) {
          await db.insert(inventoryTransactions).values({ variantId: v.id, change: stock, reason: "initial_stock" });
        }
      }
    }
    count++;
  }

  console.log("→ Creating coupons + settings…");
  await db.insert(coupons).values([
    { code: "WELCOME10", type: "percent" as const, value: 10, minOrder: 99900, maxUses: 1000, active: true },
    { code: "FLAT200", type: "fixed" as const, value: 20000, minOrder: 149900, maxUses: 500, active: true },
  ]);

  const settingsRows: { key: string; value: object }[] = [
    { key: "shipping", value: { fee: 9900, freeOver: 149900, codEnabled: true, estimate: "3–6 business days across India" } },
    { key: "hero", value: { kicker: "Everyday fashion · Made for everyone", title: "STYLE YOUR WAY", subtitle: "Everyday clothing and carefully selected styles for every occasion.", image: "/images/hero.jpg", cta: "Shop new arrivals" } },
    { key: "promo", value: { enabled: true, text: "Festive drop — extra 10% off with code WELCOME10", cta: "Shop the drop", href: "/shop?sort=new" } },
    { key: "social", value: { instagram: "", instagramImages: [
      { url: PX(28484979), alt: "Urban fashion portrait" },
      { url: PX(40765372), alt: "Streetwear model dark wall" },
      { url: PX(31502130), alt: "Editorial streetwear night" },
      { url: PX(36976941), alt: "Leather jacket night" },
      { url: PX(35150074), alt: "Industrial staircase" },
      { url: PX(39742957), alt: "Vintage door fashion" },
    ] } },
    { key: "contact", value: { email: "hello@example.com", phone: "+91 90000 00000", address: "CLOTHING STORE Demo", city: "India · Ships nationwide" } },
    { key: "testimonials", value: [
      { name: "Arjun K.", location: "Mumbai", quote: "The heavyweight tee fits exactly how oversized should. Quality genuinely surprised me.", rating: 5 },
      { name: "Priya M.", location: "Bengaluru", quote: "The hoodie is my most-complimented piece. Shipping was quick and COD made it easy.", rating: 5 },
      { name: "Rahul S.", location: "Delhi", quote: "Cargo pants are built like tanks but drape clean. Already waiting for the next drop.", rating: 4 },
    ] },
  ];
  for (const row of settingsRows) {
    await db.insert(siteSettings).values(row).onConflictDoUpdate({ target: siteSettings.key, set: { value: row.value } });
  }

  console.log(`\n✓ Seed complete — ${count} products across 5 categories.`);
  console.log(`  Admin account: ${ADMIN_EMAIL}`);
  console.log(`  Demo account: ${DEMO_EMAIL}`);
  console.log(`  Coupons: WELCOME10 (10% off, min ₹999), FLAT200 (₹200 off, min ₹1,499)`);

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});

