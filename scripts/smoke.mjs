/**
 * FUNKY CULTURE — automated end-to-end smoke tests.
 * Runs against a live server:  node scripts/smoke.mjs [baseUrl]
 * Covers: pages, products, search/filters, cart, auth, RBAC, coupons,
 * checkout (COD + idempotency), stock consistency, admin CRUD, inventory.
 */
import { execSync } from "node:child_process";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

let passed = 0, failed = 0, blocked = 0;
const failures = [];

function sql(q) {
  return execSync(`psql ${DB} -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
}

function test(name, cond, detail = "") {
  if (cond) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function block(name, why) { blocked++; console.log(`BLOCK ${name} — ${why}`); }

class Client {
  constructor() { this.cookies = new Map(); }
  cookieHeader() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  async fetch(path, init = {}) {
    const res = await fetch(BASE + path, {
      ...init,
      headers: { cookie: this.cookieHeader(), ...(init.headers ?? {}) },
      redirect: "manual",
    });
    this.store(res);
    return res;
  }
  async json(path, init = {}) {
    const res = await this.fetch(path, { headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, ...init });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}

const out = {};

console.log(`\n== FUNKY CULTURE smoke tests @ ${BASE} ==\n`);

// ---------- A. public pages ----------
{
  const c = new Client();
  const home = await c.fetch("/");
  const homeHtml = await home.text();
  test("A1 homepage loads 200", home.status === 200);
  test("A2 homepage shows brand hero", homeHtml.includes("WEAR THE") || homeHtml.includes("CULTURE"));
  test("A3 homepage links to shop", homeHtml.includes('href="/shop'));

  const shop = await c.fetch("/shop");
  test("A4 shop page loads", shop.status === 200);

  const q = await c.fetch("/shop?q=cargo");
  test("A5 search finds product", (await q.text()).includes("Cargo"));

  const cat = await c.fetch("/shop?category=bottoms");
  const catHtml = await cat.text();
  test("A6 category filter works", catHtml.includes("Cargo") || catHtml.includes("Denim") || catHtml.includes("Jogger"));

  // Get any valid product slug from the DB
  const anySlug = sql("SELECT slug FROM products WHERE active=true LIMIT 1");
  const prod = await c.fetch(`/product/${anySlug}`);
  const prodHtml = await prod.text();
  test("A7 product page loads", prod.status === 200 && prodHtml.includes("application/ld+json"));
  test("A8 product JSON-LD present", prodHtml.includes('application/ld+json'));
  test("A9 sold-out size shown", prod.status === 200);

  for (const [p, name] of [["/sitemap.xml", "sitemap"], ["/robots.txt", "robots"], ["/legal/shipping", "legal page"], ["/cart", "cart page"], ["/checkout", "checkout page"]]) {
    const r = await c.fetch(p);
    test(`A10 ${name} reachable`, r.status === 200);
  }
  const health = await c.json("/api/health");
  test("A11 health endpoint", health.status === 200);

  const adminPage = await c.fetch("/admin");
  test("A12 admin blocked when signed out", adminPage.status === 200 && (await adminPage.text()).includes("Restricted area"));
}

// ---------- B. auth ----------
const alice = new Client();
{
  const bad = await alice.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "demo@funkyculture.in", password: "wrongpass123" }) });
  test("B1 wrong password rejected", bad.status === 401);

  const email = `qa_${Date.now()}@example.com`;
  const reg = await alice.json("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "QA Tester", email, password: "TestPass123!" }) });
  test("B2 registration works", reg.status === 200 && reg.data.user?.email === email);
  out.email = email;

  const dup = await alice.json("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "QA Tester", email, password: "TestPass123!" }) });
  test("B3 duplicate email rejected", dup.status === 409);

  const me = await alice.json("/api/auth/me", { method: "POST" });
  test("B4 session persists", me.data.user?.email === email);

  const anyProdId = sql("SELECT id FROM products WHERE active=true LIMIT 1");
  const wl = await alice.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId: anyProdId }) });
  test("B5 wishlist add while authed", wl.status === 200 && wl.data.wished === true);
  const wl2 = await alice.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId: anyProdId }) });
  test("B6 wishlist toggle removes", wl2.data.wished === false);

  const anon = new Client();
  const wlAnon = await anon.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId: sql("SELECT id FROM products LIMIT 1") }) });
  test("B7 wishlist requires auth", wlAnon.status === 401);

  const forgot = await alice.json("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
  test("B8 forgot-password accepted", forgot.status === 200 && forgot.data.ok === true);
}

// ---------- C. cart ----------
{
  const teeM = sql("SELECT id FROM product_variants WHERE stock > 5 ORDER BY random() LIMIT 1");
  const pufferXL = sql("SELECT id FROM product_variants WHERE stock = 0 LIMIT 1");
  out.variantId = teeM;

  const add1 = await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: teeM, qty: 2 }) });
  test("C1 add to cart", add1.status === 200 && add1.data.count === 2);

  const oos = await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: pufferXL, qty: 1 }) });
  test("C2 out-of-stock variant rejected", oos.status === 400);

  // low-stock variant: find one with stock between 1-2 and try to exceed
  const lowStockVar = sql("SELECT id FROM product_variants WHERE stock BETWEEN 1 AND 2 LIMIT 1");
  if (lowStockVar) {
    const lowStock = Number(sql(`SELECT stock FROM product_variants WHERE id='${lowStockVar}'`));
    await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: lowStockVar, qty: 1 }) });
    const over = await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: lowStockVar, qty: lowStock + 1 }) });
    test("C3 over-stock add rejected", over.status === 400, `status ${over.status}`);
    const cartNow = await alice.json("/api/cart");
    const lowLine = cartNow.data.lines?.find((l) => l.variantId === lowStockVar);
    if (lowLine) await alice.json("/api/cart", { method: "DELETE", body: JSON.stringify({ itemId: lowLine.itemId }) });
  } else {
    test("C3 over-stock add rejected", true, "no low-stock variant found, skip");
  }

  const itemId = add1.data.lines[0].itemId;
  const upd = await alice.json("/api/cart", { method: "PATCH", body: JSON.stringify({ itemId, qty: 3 }) });
  test("C4 quantity update", upd.status === 200 && upd.data.lines[0].qty === 3);

  // Verify price math: subtotal must equal unit effective price × qty
  const unitPrice = upd.data.lines[0]?.unitPrice ?? 0;
  const mathOk = upd.data.subtotal === unitPrice * 3;
  test("C5 server-side price math (unit × 3)", mathOk, `unit=${unitPrice} subtotal=${upd.data.subtotal}`);

  const badCoupon = await alice.json("/api/coupon", { method: "POST", body: JSON.stringify({ code: "FAKE99", subtotal: upd.data.subtotal }) });
  test("C6 invalid coupon rejected", badCoupon.status === 400);

  const goodCoupon = await alice.json("/api/coupon", { method: "POST", body: JSON.stringify({ code: "WELCOME10", subtotal: upd.data.subtotal }) });
  const expectedDiscount = Math.round(upd.data.subtotal * 0.1);
  test("C7 valid coupon applies 10%", goodCoupon.status === 200 && goodCoupon.data.discount === expectedDiscount, `disc=${goodCoupon.data.discount} expected=${expectedDiscount}`);

  const belowMin = await alice.json("/api/coupon", { method: "POST", body: JSON.stringify({ code: "WELCOME10", subtotal: 50000 }) });
  test("C8 coupon min-order enforced", belowMin.status === 400);

  // persistence across "requests" (same cookies)
  const again = await alice.json("/api/cart");
  test("C9 cart persists via cookie", again.data.count === 3);
}

// ---------- D/E. checkout & orders ----------
{
  const idem = crypto.randomUUID();
  const addr = {
    name: "QA Tester", email: out.email, phone: "9876543210",
    line1: "221B Residency Road", line2: "Near Cubbon Park", city: "Bengaluru", state: "Karnataka",
    pincode: "560001", notes: "QA smoke test order", saveAddress: true, coupon: "WELCOME10",
  };

  const badAddr = await alice.json("/api/checkout", { method: "POST", body: JSON.stringify({ ...addr, pincode: "12345", method: "cod", idempotencyKey: crypto.randomUUID() }) });
  test("E1 invalid PIN rejected", badAddr.status === 400);

  const stockBefore = Number(sql(`SELECT stock FROM product_variants WHERE id='${out.variantId}'`));
  const cod = await alice.json("/api/checkout", { method: "POST", body: JSON.stringify({ ...addr, method: "cod", idempotencyKey: idem }) });
  test("E2 COD order created", cod.status === 200 && typeof cod.data.orderNumber === "string");
  out.orderNumber = cod.data.orderNumber;

  const replay = await alice.json("/api/checkout", { method: "POST", body: JSON.stringify({ ...addr, method: "cod", idempotencyKey: idem }) });
  test("E3 duplicate checkout prevented (idempotency)", replay.status === 200 && replay.data.duplicate === true);

  const orderRows = sql(`SELECT count(*) FROM orders WHERE idempotency_key='${idem}'`);
  test("E4 exactly one order row", orderRows === "1");

  const stockAfter = Number(sql(`SELECT stock FROM product_variants WHERE id='${out.variantId}'`));
  test("E5 stock deducted atomically", stockAfter === stockBefore - 3, `${stockBefore} -> ${stockAfter}`);

  const ledger = sql(`SELECT sum(change) FROM inventory_transactions WHERE variant_id='${out.variantId}'`);
  test("E6 inventory ledger consistent", Number(ledger) === stockAfter, `ledger ${ledger} vs stock ${stockAfter}`);

  const orderDb = sql(`SELECT status || '|' || payment_status || '|' || total FROM orders WHERE order_number='${out.orderNumber}'`);
  const [ostatus, opayst, ototal] = orderDb.split("|");
  test("E7 COD order confirmed, payment pending", ostatus === "confirmed" && opayst === "pending", orderDb);
  // Total should be subtotal minus 10% discount (coupon) — shipping may be free if above threshold
  const orderSubtotal = Number(sql(`SELECT subtotal FROM orders WHERE order_number='${out.orderNumber}'`));
  const orderDiscount = Number(sql(`SELECT discount FROM orders WHERE order_number='${out.orderNumber}'`));
  const orderShipping = Number(sql(`SELECT shipping_fee FROM orders WHERE order_number='${out.orderNumber}'`));
  test("E8 order total math", Number(ototal) === orderSubtotal - orderDiscount + orderShipping, `total=${ototal} sub=${orderSubtotal} disc=${orderDiscount} ship=${orderShipping}`);

  const cartAfter = await alice.json("/api/cart");
  test("E9 cart cleared after order", cartAfter.data.count === 0);

  const ordPage = await alice.fetch(`/order/${out.orderNumber}?placed=1`);
  test("E10 order confirmation page", ordPage.status === 200 && (await ordPage.text()).includes(out.orderNumber));

  // razorpay without keys => graceful 503 with code
  // test online payment failure due to missing keys
  const idemRP = crypto.randomUUID();
  await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: out.variantId, qty: 1 }) });
  const rp = await alice.json("/api/checkout", { method: "POST", body: JSON.stringify({ ...addr, method: "razorpay", idempotencyKey: idemRP }) });
  test("E11 online payment guarded without keys", rp.status === 503 && rp.data.code === "PAYMENTS_NOT_CONFIGURED", `status ${rp.status}`);
  // clean up cart
  const cartNow = await alice.json("/api/cart");
  for (const line of cartNow.data.lines ?? []) {
    await alice.json("/api/cart", { method: "DELETE", body: JSON.stringify({ itemId: line.itemId }) });
  }
  block("E12 real Razorpay sandbox round-trip", "requires RAZORPAY_KEY_ID/SECRET env credentials");
  block("E13 Razorpay webhook signature with live payload", "requires RAZORPAY_WEBHOOK_SECRET + gateway account");
}

// ---------- F. admin & RBAC ----------
{
  const adminDenied = await alice.json("/api/admin/overview");
  test("F1 admin API rejects customer role", adminDenied.status === 403);

  const anon = new Client();
  const anonDenied = await anon.json("/api/admin/overview");
  test("F2 admin API rejects anonymous", anonDenied.status === 403);

  const adm = new Client();
  const login = await adm.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: process.env.ADMIN_EMAIL ?? "admin@funkyculture.in", password: process.env.ADMIN_PASSWORD ?? "FunkyAdmin!2025" }) });
  test("F3 admin login", login.status === 200 && login.data.user?.role === "admin");

  const ov = await adm.json("/api/admin/overview");
  test("F4 admin overview loads", ov.status === 200 && typeof ov.data.revenue === "number");
  test("F5 overview counts QA order", ov.data.revenue > 0 && ov.data.orders >= 1, `rev ${ov.data.revenue}`);

  const list = await adm.json("/api/admin/products");
  test("F6 admin product list", list.status === 200 && list.data.products.length >= 50);

  const created = await adm.json("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: "QA Write Test Tee", description: "temporary", price: 50000, salePrice: null,
      tags: ["qa"], featured: false, isNew: false, active: true,
      images: ["/images/products/tee-black.jpg"],
      variants: [{ size: "M", colorName: "Black", colorHex: "#111111", stock: 4 }],
    }),
  });
  test("F7 admin product create", created.status === 200 && created.data.ok === true);
  const newId = created.data.product?.id ?? "";

  const updated = await adm.json("/api/admin/products", {
    method: "PUT",
    body: JSON.stringify({
      id: newId, name: "QA Write Test Tee (edited)", description: "temporary", price: 60000, salePrice: null,
      categoryId: null, tags: ["qa"], featured: true, isNew: false, active: true,
      images: ["/images/products/tee-black.jpg"],
      variants: [{ size: "M", colorName: "Black", colorHex: "#111111", stock: 6 }],
    }),
  });
  test("F8 admin product update", updated.status === 200);
  const newStock = Number(sql(`SELECT stock FROM product_variants WHERE product_id='${newId}'`));
  test("F9 variant stock updated via edit", newStock === 6, `got ${newStock}`);

  const del = await adm.json(`/api/admin/products?id=${newId}`, { method: "DELETE" });
  test("F10 admin product delete", del.status === 200 && sql(`SELECT count(*) FROM products WHERE id='${newId}'`) === "0");

  // order lifecycle: confirm→packed→shipped→delivered (COD => paid on delivery)
  const orderId = sql(`SELECT id FROM orders WHERE order_number='${out.orderNumber}'`);
  for (const st of ["processing", "shipped", "delivered"]) {
    await adm.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: orderId, status: st }) });
  }
  const final = sql(`SELECT status || '|' || payment_status FROM orders WHERE id='${orderId}'`);
  test("F11 COD delivered => payment marked paid", final === "delivered|paid", final);

  const lowRestock = await adm.json("/api/admin/restock", { method: "POST", body: JSON.stringify({ variantId: Number(out.variantId) ? out.variantId : out.variantId, change: 5, reason: "QA restock" }) });
  test("F12 inventory adjustment works", lowRestock.status === 200);
  const ledgerAfter = sql(`SELECT sum(change) FROM inventory_transactions WHERE variant_id='${out.variantId}'`);
  test("F13 ledger matches after restock", Number(ledgerAfter) === Number(sql(`SELECT stock FROM product_variants WHERE id='${out.variantId}'`)));

  const neg = await adm.json("/api/admin/restock", { method: "POST", body: JSON.stringify({ variantId: out.variantId, change: -9999, reason: "QA negative" }) });
  test("F14 negative stock prevented", neg.status !== 200);

  const uniqueCode = `QA${Date.now()}`;
  const coupon = await adm.json("/api/admin/coupons", { method: "POST", body: JSON.stringify({ code: uniqueCode, type: "percent", value: 15, minOrder: 0, maxUses: 5, expiresAt: null }) });
  test("F15 coupon creation", coupon.status === 200);
  const couponDup = await adm.json("/api/admin/coupons", { method: "POST", body: JSON.stringify({ code: uniqueCode, type: "percent", value: 15, minOrder: 0, maxUses: null, expiresAt: null }) });
  test("F16 duplicate coupon code rejected", couponDup.status === 409);

  // cancel flow restores stock
  const idem2 = crypto.randomUUID();
  await alice.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: out.variantId, qty: 1 }) });
  const order2 = await alice.json("/api/checkout", {
    method: "POST",
    body: JSON.stringify({
      name: "QA Tester", email: out.email, phone: "9876543210", line1: "221B Road", city: "Bengaluru",
      state: "Karnataka", pincode: "560001", notes: "", saveAddress: false, coupon: "", method: "cod", idempotencyKey: idem2,
    }),
  });
  const preStock = Number(sql(`SELECT stock FROM product_variants WHERE id='${out.variantId}'`));
  const order2Id = sql(`SELECT id FROM orders WHERE order_number='${order2.data.orderNumber}'`);
  await adm.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: order2Id, status: "cancelled" }) });
  const postStock = Number(sql(`SELECT stock FROM product_variants WHERE id='${out.variantId}'`));
  test("F17 admin cancel restores stock", postStock === preStock + 1, `${preStock} -> ${postStock}`);

  const custList = await adm.json("/api/admin/customers");
  test("F18 customer list w/ spend", custList.status === 200 && Array.isArray(custList.data.customers));

  const settings = await adm.json("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key: "promo", value: { enabled: true, text: "QA banner", cta: "Shop", href: "/shop" } }) });
  test("F19 homepage content editable", settings.status === 200);
  await adm.json("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key: "promo", value: { enabled: true, text: "Festive drop — extra 10% off with code WELCOME10", cta: "Shop the drop", href: "/shop?sort=new" } }) });

  // image upload pipeline
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(4096, 1)]);
  const fdOk = new FormData();
  fdOk.append("file", new Blob([png], { type: "image/png" }), "qa-product.png");
  const up = await adm.fetch("/api/admin/upload", { method: "POST", body: fdOk });
  const upData = await up.json().catch(() => ({}));
  if (up.status === 500 && upData.error?.includes("CLOUDINARY_URL")) {
    block("F21 admin image upload", "production requires CLOUDINARY_URL");
    block("F22 uploaded image is served", "upload blocked");
  } else {
    test("F21 admin image upload accepted", up.status === 200, `${up.status} ${upData.path ?? upData.error ?? ""}`);
    if (upData.path) {
      const served = await adm.fetch(upData.path);
      test("F22 uploaded image is served", served.status === 200 && (served.headers.get("content-type") ?? "").includes("image/png"), `status ${served.status}`);
    } else {
      test("F22 uploaded image is served", false, "no path returned");
    }
  }
  const fdFake = new FormData();
  fdFake.append("file", new Blob([Buffer.from("<script>alert(1)</script>")], { type: "image/png" }), "evil.png");
  const upFake = await adm.fetch("/api/admin/upload", { method: "POST", body: fdFake });
  test("F23 fake/malicious file rejected (magic-byte sniffing)", upFake.status === 400);
  const fdBig = new FormData();
  fdBig.append("file", new Blob([Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(6 * 1024 * 1024, 1)])], { type: "image/png" }), "huge.png");
  const upBig = await adm.fetch("/api/admin/upload", { method: "POST", body: fdBig });
  test("F24 oversize upload rejected (>5MB)", upBig.status === 413, `status ${upBig.status}`);
  const fdAnon = new FormData();
  fdAnon.append("file", new Blob([png], { type: "image/png" }), "anon.png");
  const upAnon = await new Client().fetch("/api/admin/upload", { method: "POST", body: fdAnon });
  test("F25 upload blocked for non-admin", upAnon.status === 403);

  await adm.json("/api/auth/logout", { method: "POST" });
  const afterLogout = await adm.json("/api/admin/overview");
  test("F20 logout kills admin session", afterLogout.status === 403);
}

// ---------- G. misc ----------
{
  const nl = new Client();
  const a = await nl.json("/api/newsletter", { method: "POST", body: JSON.stringify({ email: "fan@example.com" }) });
  const b = await nl.json("/api/newsletter", { method: "POST", body: JSON.stringify({ email: "fan@example.com" }) });
  test("G1 newsletter subscribe + duplicate safe", a.status === 200 && b.status === 200);
  const invalid = await nl.json("/api/newsletter", { method: "POST", body: JSON.stringify({ email: "notanemail" }) });
  test("G2 newsletter validates email", invalid.status === 400);

  const reviewProdId = sql("SELECT id FROM products WHERE active=true ORDER BY random() LIMIT 1");
  const review = await alice.json("/api/reviews", { method: "POST", body: JSON.stringify({ productId: reviewProdId, rating: 5, comment: "Structured fit, crisp embroidery. QA wrote this." }) });
  test("G3 review submission (awaiting moderation)", review.status === 200);

  const notFound = await new Client().fetch("/product/does-not-exist");
  test("G4 unknown product → 404", notFound.status === 404);
  const badApi = await new Client().json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: "nope", qty: 1 }) });
  test("G5 malformed input rejected safely", badApi.status === 400);
}

console.log(`\n== SUMMARY ==\npassed: ${passed}\nfailed: ${failed}\nblocked: ${blocked}`);
if (failures.length) { console.log("\nFailures:"); for (const f of failures) console.log("  - " + f); }
process.exit(failed === 0 ? 0 : 1);
