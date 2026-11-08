/**
 * CLOTHING STORE — COMPREHENSIVE FULL SYSTEM TEST
 *
 * Run against a live production server:
 *   node scripts/full_audit.mjs [baseUrl]
 */
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const DB = "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

let passed = 0, failed = 0, blocked = 0;
const failures = [];

function sql(q) {
  try {
    return execSync(`psql ${DB} -tAc "${q.replace(/"/g, '\\"').replace(/\n/g, " ")}"`).toString().trim();
  } catch {
    return "";
  }
}

function test(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function block(name, why) {
  blocked++;
  console.log(`BLOCK ${name} — ${why}`);
}

class Client {
  constructor(name = "anon") {
    this.cookies = new Map();
    this.name = name;
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
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
    const res = await this.fetch(path, {
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      ...init,
    });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}

console.log(`\n== CLOTHING STORE comprehensive audit @ ${BASE} ==\n`);

// ─────────────────────────────────────────────────────────────
// 1. Core pages
// ─────────────────────────────────────────────────────────────
const anon = new Client();
const health = await anon.json("/api/health");
test("A1 health endpoint", health.status === 200);

test("A2 homepage loads", (await anon.fetch("/")).status === 200);
test("A3 shop loads", (await anon.fetch("/shop")).status === 200);
test("A4 cart loads", (await anon.fetch("/cart")).status === 200);
test("A5 checkout loads", (await anon.fetch("/checkout")).status === 200);
test("A6 robots loads", (await anon.fetch("/robots.txt")).status === 200);
test("A7 sitemap loads", (await anon.fetch("/sitemap.xml")).status === 200);
const anySlug = sql("SELECT slug FROM products WHERE active=true LIMIT 1");
test("A8 product page loads", (await anon.fetch(`/product/${anySlug}`)).status === 200);
test("A9 unknown product 404", (await anon.fetch("/product/does-not-exist")).status === 404);

// ─────────────────────────────────────────────────────────────
// 2. Customer auth + cart + checkout
// ─────────────────────────────────────────────────────────────
const ts = Date.now();
const customerEmail = `test_customer_${ts}@demo.com`;
const customerPwd = "TestPass123!";
const customer = new Client("customer");

test("B1 wrong password rejected", (await customer.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: customerEmail, password: "wrong" }) })).status === 401);
const reg = await customer.json("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Test Customer", email: customerEmail, phone: "9876543210", password: customerPwd }) });
test("B2 customer registration", reg.status === 200 && reg.data.ok);
test("B3 duplicate email rejected", (await customer.json("/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Test", email: customerEmail, password: customerPwd }) })).status === 409);
test("B4 session persists", (await customer.json("/api/auth/me", { method: "POST" })).data.user?.email === customerEmail);
test("B5 forgot password accepted", (await anon.json("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email: customerEmail }) })).status === 200);

const v1 = sql("SELECT id FROM product_variants WHERE stock > 5 LIMIT 1");
const v2 = sql(`SELECT id FROM product_variants WHERE stock > 5 AND id != '${v1}' LIMIT 1`);
const oos = sql("SELECT id FROM product_variants WHERE stock = 0 LIMIT 1");

test("C1 add item to cart", (await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: v1, qty: 2 }) })).status === 200);
test("C2 add second item", (await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: v2, qty: 1 }) })).status === 200);
if (oos) test("C3 out of stock rejected", (await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: oos, qty: 1 }) })).status === 400);
const cart = await customer.json("/api/cart");
test("C4 cart persists", cart.status === 200 && cart.data.count >= 3);
test("C5 coupon works", (await customer.json("/api/coupon", { method: "POST", body: JSON.stringify({ code: "WELCOME10", subtotal: cart.data.subtotal }) })).status === 200);

const idem = crypto.randomUUID();
const stockBefore = Number(sql(`SELECT stock FROM product_variants WHERE id='${v1}'`));
const cod = await customer.json("/api/checkout", {
  method: "POST",
  body: JSON.stringify({
    name: "Test Customer", email: customerEmail, phone: "9876543210",
    line1: "123 Test Street", line2: "", city: "Mumbai", state: "Maharashtra", pincode: "400001",
    method: "cod", coupon: "WELCOME10", notes: "Leave at door", saveAddress: true,
    idempotencyKey: idem,
  }),
});
test("D1 COD order created", cod.status === 200 && typeof cod.data.orderNumber === "string");
const orderNum = cod.data.orderNumber;
const orderId = sql(`SELECT id FROM orders WHERE order_number='${orderNum}'`);
test("D2 duplicate checkout prevented", (await customer.json("/api/checkout", { method: "POST", body: JSON.stringify({ name: "Test Customer", email: customerEmail, phone: "9876543210", line1: "123 Test Street", city: "Mumbai", state: "Maharashtra", pincode: "400001", method: "cod", coupon: "", notes: "", saveAddress: false, idempotencyKey: idem }) })).data.duplicate === true);
test("D3 stock deducted", Number(sql(`SELECT stock FROM product_variants WHERE id='${v1}'`)) === stockBefore - 2);
test("D4 order page loads", (await customer.fetch(`/order/${orderNum}?placed=1`)).status === 200);

await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: v1, qty: 1 }) });
const noKeys = await customer.json("/api/checkout", {
  method: "POST",
  body: JSON.stringify({ name: "Test Customer", email: customerEmail, phone: "9876543210", line1: "123 St", city: "Mumbai", state: "Maharashtra", pincode: "400001", method: "razorpay", coupon: "", notes: "", saveAddress: false, idempotencyKey: crypto.randomUUID() }),
});
test("D5 online payment guarded without keys", noKeys.status === 503 && noKeys.data.code === "PAYMENTS_NOT_CONFIGURED");
block("D6 live Razorpay payment", "requires merchant sandbox/live credentials");
block("D7 live Razorpay webhook", "requires webhook secret + gateway event delivery");
const c3 = await customer.json("/api/cart");
for (const l of c3.data.lines ?? []) await customer.json("/api/cart", { method: "DELETE", body: JSON.stringify({ itemId: l.itemId }) });

// ─────────────────────────────────────────────────────────────
// 3. Wishlist, notifications, reorder, review, newsletter
// ─────────────────────────────────────────────────────────────
const productId = sql("SELECT id FROM products WHERE active=true LIMIT 1");
test("E1 wishlist add", (await customer.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId }) })).data.wished === true);
test("E2 wishlist toggle remove", (await customer.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId }) })).data.wished === false);
test("E3 wishlist auth required", (await anon.json("/api/wishlist", { method: "POST", body: JSON.stringify({ productId }) })).status === 401);

const notifBefore = await customer.json("/api/notifications");
test("E4 notifications load", notifBefore.status === 200 && Array.isArray(notifBefore.data.notifications));
if (notifBefore.data.notifications.length) {
  const first = notifBefore.data.notifications[0].id;
  test("E5 mark single notification read", (await customer.json("/api/notifications", { method: "PATCH", body: JSON.stringify({ action: "mark_read", ids: [first] }) })).status === 200);
  test("E6 mark all notifications read", (await customer.json("/api/notifications", { method: "PATCH", body: JSON.stringify({ action: "mark_all_read" }) })).status === 200);
}

test("E7 reorder past order", (await customer.json("/api/order/reorder", { method: "POST", body: JSON.stringify({ orderId }) })).status === 200);
const reCart = await customer.json("/api/cart");
test("E8 reorder repopulates cart", reCart.data.count >= 1);
for (const l of reCart.data.lines ?? []) await customer.json("/api/cart", { method: "DELETE", body: JSON.stringify({ itemId: l.itemId }) });

test("E9 submit review", (await customer.json("/api/reviews", { method: "POST", body: JSON.stringify({ productId, rating: 5, comment: "Excellent quality." }) })).status === 200);
test("E10 review auth required", (await anon.json("/api/reviews", { method: "POST", body: JSON.stringify({ productId, rating: 3, comment: "test" }) })).status === 401);
test("E11 newsletter subscribe", (await anon.json("/api/newsletter", { method: "POST", body: JSON.stringify({ email: `newsletter_${ts}@test.com` }) })).status === 200);

// ─────────────────────────────────────────────────────────────
// 4. Admin
// ─────────────────────────────────────────────────────────────
const admin = new Client("admin");
test("F1 admin wrong password rejected", (await admin.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@funkyculture.in", password: "wrong_password" }) })).status === 401);
const adminLogin = await admin.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@funkyculture.in", password: "FunkyAdmin!2025" }) });
test("F2 admin login succeeds", adminLogin.status === 200 && adminLogin.data.user?.role === "admin");
test("F3 customer blocked from admin", (await customer.json("/api/admin/overview")).status === 403);
test("F4 anon blocked from admin", (await anon.json("/api/admin/overview")).status === 403);
const overview = await admin.json("/api/admin/overview");
test("F5 overview loads", overview.status === 200);
test("F6 overview KPIs present", ["revenue","orders","avgOrderValue","customers","pendingDeliveries","completedDeliveries"].every(k => k in overview.data));

test("F7 product list loads", (await admin.json("/api/admin/products")).status === 200);
const prod = await admin.json("/api/admin/products", {
  method: "POST",
  body: JSON.stringify({ name: "Admin Test Product", brand: "Test Brand", description: "Admin test product", price: 199900, salePrice: 149900, categoryId: null, tags: ["test"], featured: false, isNew: true, active: false, images: ["/images/products/tee-black.jpg"], variants: [{ size: "M", colorName: "Black", colorHex: "#000000", stock: 10 }] }),
});
test("F8 admin create product", prod.status === 200 && prod.data.ok);
const prodId = prod.data.product?.id;
if (prodId) {
  test("F9 admin update product", (await admin.json("/api/admin/products", { method: "PUT", body: JSON.stringify({ id: prodId, name: "Admin Test Product Updated", brand: "Test Brand", description: "Updated", price: 249900, salePrice: null, categoryId: null, tags: ["updated"], featured: true, isNew: false, active: true, images: ["/images/products/tee-black.jpg"], variants: [{ size: "M", colorName: "Black", colorHex: "#000000", stock: 15 }] }) })).status === 200);
  const dup = await admin.json("/api/admin/products", { method: "POST", body: JSON.stringify({ action: "duplicate", id: prodId }) });
  test("F10 admin duplicate product", dup.status === 200 && dup.data.ok);
  const dupId = dup.data.product?.id;
  if (dupId) {
    test("F11 duplicate hidden by default", ["f", "false"].includes(sql(`SELECT active::text FROM products WHERE id='${dupId}'`)));
    test("F12 duplicate variants zero stock", sql(`SELECT coalesce(sum(stock),0) FROM product_variants WHERE product_id='${dupId}'`) === "0");
    await admin.json(`/api/admin/products?id=${dupId}`, { method: "DELETE" });
  }
  test("F13 admin delete product", (await admin.json(`/api/admin/products?id=${prodId}`, { method: "DELETE" })).status === 200);
}

test("F14 categories list loads", (await admin.json("/api/admin/categories")).status === 200);
const cat = await admin.json("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: "QA Test Category", description: "Test" }) });
test("F15 admin create category", cat.status === 200 && cat.data.ok);
const catId = cat.data.category?.id;
if (catId) {
  test("F16 admin update category", (await admin.json("/api/admin/categories", { method: "PUT", body: JSON.stringify({ id: catId, name: "QA Updated Category", description: "Updated", sort: 99 }) })).status === 200);
  test("F17 admin delete category", (await admin.json(`/api/admin/categories?id=${catId}`, { method: "DELETE" })).status === 200);
}

const inv = await admin.json("/api/admin/inventory");
test("F18 inventory loads", inv.status === 200 && Array.isArray(inv.data.inventory));
const variantToAdjust = inv.data.inventory?.[0];
if (variantToAdjust) {
  const stockBeforeAdj = variantToAdjust.stock;
  test("F19 add stock", (await admin.json("/api/admin/restock", { method: "POST", body: JSON.stringify({ variantId: variantToAdjust.id, change: 5, reason: "qa_test" }) })).status === 200);
  test("F20 stock actually increased", Number(sql(`SELECT stock FROM product_variants WHERE id='${variantToAdjust.id}'`)) === stockBeforeAdj + 5);
  test("F21 prevent negative stock", (await admin.json("/api/admin/restock", { method: "POST", body: JSON.stringify({ variantId: variantToAdjust.id, change: -99999, reason: "qa_negative" }) })).status >= 400);
  await admin.json("/api/admin/restock", { method: "POST", body: JSON.stringify({ variantId: variantToAdjust.id, change: -5, reason: "qa_restore" }) });
}

const ordList = await admin.json("/api/admin/orders");
test("F22 order list loads", ordList.status === 200 && Array.isArray(ordList.data.orders));
const testOrderRow = ordList.data.orders?.find(o => o.orderNumber === orderNum);
if (testOrderRow) {
  test("F23 admin set processing", (await admin.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: testOrderRow.id, status: "processing" }) })).status === 200);
  test("F24 admin set packed", (await admin.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: testOrderRow.id, status: "packed" }) })).status === 200);
  test("F25 admin set tracking", (await admin.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: testOrderRow.id, trackingNumber: "TRK123456789" }) })).status === 200);
}

const cp = await admin.json("/api/admin/coupons", { method: "POST", body: JSON.stringify({ code: `QA${ts}`, type: "percent", value: 25, minOrder: 0, maxUses: 100 }) });
test("F26 admin create percent coupon", cp.status === 200 && cp.data.ok);
const cp2 = await admin.json("/api/admin/coupons", { method: "POST", body: JSON.stringify({ code: `QAF${ts}`, type: "fixed", value: 50000, minOrder: 100000, maxUses: null }) });
test("F27 admin create fixed coupon", cp2.status === 200 && cp2.data.ok);
test("F28 duplicate coupon rejected", (await admin.json("/api/admin/coupons", { method: "POST", body: JSON.stringify({ code: `QA${ts}`, type: "percent", value: 10, minOrder: 0 }) })).status === 409);

const reviews = await admin.json("/api/admin/reviews");
test("F29 admin reviews list loads", reviews.status === 200 && Array.isArray(reviews.data.reviews));
const pendingReview = reviews.data.reviews?.find(r => !r.approved);
if (pendingReview) {
  test("F30 admin approve review", (await admin.json("/api/admin/reviews", { method: "PATCH", body: JSON.stringify({ id: pendingReview.id, approved: true }) })).status === 200);
  test("F31 admin unpublish review", (await admin.json("/api/admin/reviews", { method: "PATCH", body: JSON.stringify({ id: pendingReview.id, approved: false }) })).status === 200);
}

const customers = await admin.json("/api/admin/customers");
test("F32 customers list loads", customers.status === 200 && Array.isArray(customers.data.customers));
const custEntry = customers.data.customers?.find(c => c.email === customerEmail);
test("F33 customer order count correct", Number(custEntry?.orderCount) >= 1, `orderCount=${custEntry?.orderCount}`);

// Uploads
const pngMagic = Buffer.from("89504e470d0a1a0a", "hex");
const pngBody = Buffer.concat([pngMagic, Buffer.alloc(1024, 0)]);
const fdOk = new FormData();
fdOk.append("file", new Blob([pngBody], { type: "image/png" }), "test.png");
const upload = await admin.fetch("/api/admin/upload", { method: "POST", body: fdOk });
const uploadData = await upload.json();
if (upload.status === 500 && uploadData.error?.includes("CLOUDINARY_URL")) {
  block("F34 admin upload png", "production requires CLOUDINARY_URL");
  block("F35 uploaded image served", "upload blocked");
} else {
  test("F34 admin upload png", upload.status === 200 && /\/uploads\/[a-f0-9-]{36}\.png$/.test(uploadData.path ?? ""));
  if (uploadData.path) {
    test("F35 uploaded image served", (await anon.fetch(uploadData.path)).status === 200);
    await admin.fetch("/api/admin/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: uploadData.path }) });
  }
}
test("F36 fake upload rejected", (await admin.fetch("/api/admin/upload", { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", new Blob([Buffer.from("<html>evil</html>")], { type: "image/png" }), "evil.png"); return fd; })() })).status === 400);

// ─────────────────────────────────────────────────────────────
// 5. Driver portal + delivery lifecycle
// ─────────────────────────────────────────────────────────────
const driverEmail = `driver_${ts}@demo.com`;
const driverPwd = "DriverTest123!";
const createDriver = await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "create_driver", name: "QA Driver", email: driverEmail, phone: "9000000099", vehicle: "Motorbike", password: driverPwd }) });
test("G1 admin create driver", createDriver.status === 200 && createDriver.data.ok);
const driver = new Client("driver");
test("G2 driver login", (await driver.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: driverEmail, password: driverPwd }) })).status === 200);
test("G3 driver page loads", (await driver.fetch("/driver")).status === 200);
const driverId = sql(`SELECT d.id FROM drivers d JOIN users u ON u.id=d.user_id WHERE u.email='${driverEmail}'`);
const assign = await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "assign", orderId, driverId }) });
test("G4 assign order to driver", assign.status === 200 && assign.data.ok, assign.data.error ?? "");
const otp = assign.data.otp;
const assigned = await driver.json("/api/driver?view=active");
test("G5 driver sees assigned delivery", assigned.data.deliveries?.length === 1, `count=${assigned.data.deliveries?.length}`);
const assignmentId = assigned.data.deliveries?.[0]?.id;
const detail = await driver.json(`/api/driver?view=detail&id=${assignmentId}`);
test("G6 driver detail loads", detail.status === 200 && detail.data.delivery?.orderNumber === orderNum);
test("G7 invalid transition rejected", (await driver.json("/api/driver", { method: "POST", body: JSON.stringify({ assignmentId, status: "delivered" }) })).status === 400);
test("G8 driver accepts", (await driver.json("/api/driver", { method: "POST", body: JSON.stringify({ assignmentId, status: "accepted", note: "On the way" }) })).status === 200);
test("G9 driver picked up", (await driver.json("/api/driver", { method: "POST", body: JSON.stringify({ assignmentId, status: "picked_up", note: "Collected" }) })).status === 200);
test("G10 driver out for delivery", (await driver.json("/api/driver", { method: "POST", body: JSON.stringify({ assignmentId, status: "out_for_delivery" }) })).status === 200);
const deliver = await driver.json("/api/driver", { method: "POST", body: JSON.stringify({ assignmentId, status: "delivered", otp, note: "Delivered successfully" }) });
test("G11 driver delivers with OTP", deliver.status === 200 && deliver.data.otpVerified === true);

// Correct DB verification queries (fixed precedence bugs)
const deliveredStatus = sql(`SELECT status FROM delivery_assignments WHERE id='${assignmentId}'`);
const deliveredOtp = sql(`SELECT otp_verified::text FROM delivery_assignments WHERE id='${assignmentId}'`);
const deliveredHasTs = sql(`SELECT (delivered_at IS NOT NULL)::text FROM delivery_assignments WHERE id='${assignmentId}'`);
const orderStatus = sql(`SELECT status FROM orders WHERE id='${orderId}'`);
const paymentStatus = sql(`SELECT payment_status FROM orders WHERE id='${orderId}'`);
const events = sql(`SELECT count(*) FROM delivery_events WHERE assignment_id='${assignmentId}'`);

test("G12 assignment status = delivered", deliveredStatus === "delivered", `status=${deliveredStatus}`);
test("G13 otp_verified = true", ["t","true"].includes(deliveredOtp), `otp_verified=${deliveredOtp}`);
test("G14 delivered_at populated", ["t","true"].includes(deliveredHasTs), `has_ts=${deliveredHasTs}`);
test("G15 order status = delivered", orderStatus === "delivered", `status=${orderStatus}`);
test("G16 COD marked paid", paymentStatus === "paid", `payment=${paymentStatus}`);
test("G17 delivery audit trail >= 4", Number(events) >= 4, `events=${events}`);
test("G18 driver completed deliveries loads", (await driver.json("/api/driver?view=completed")).status === 200);

// Reassign flow
await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: v2, qty: 1 }) });
const order2 = await customer.json("/api/checkout", { method: "POST", body: JSON.stringify({ name: "Test Customer", email: customerEmail, phone: "9876543210", line1: "123 St", city: "Mumbai", state: "Maharashtra", pincode: "400001", method: "cod", coupon: "", notes: "", saveAddress: false, idempotencyKey: crypto.randomUUID() }) });
const orderId2 = sql(`SELECT id FROM orders WHERE order_number='${order2.data.orderNumber}'`);
const assign2 = await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "assign", orderId: orderId2, driverId }) });
const assignmentId2 = assign2.data.assignment?.id;
const driver2Email = `driver2_${ts}@demo.com`;
await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "create_driver", name: "QA Driver 2", email: driver2Email, phone: "9000000098", vehicle: "Van", password: driverPwd }) });
const driverId2 = sql(`SELECT d.id FROM drivers d JOIN users u ON u.id=d.user_id WHERE u.email='${driver2Email}'`);
const reassign = await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "reassign", assignmentId: assignmentId2, newDriverId: driverId2 }) });
test("G19 admin reassign delivery", reassign.status === 200 && reassign.data.ok, reassign.data.error ?? "");
const driver2 = new Client("driver2");
await driver2.json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: driver2Email, password: driverPwd }) });
const driver2Active = await driver2.json("/api/driver?view=active");
test("G20 new driver sees reassigned delivery", driver2Active.data.deliveries?.length === 1, `count=${driver2Active.data.deliveries?.length}`);
const oldDriverActive = await driver.json("/api/driver?view=active");
test("G21 original driver no longer sees reassigned delivery", oldDriverActive.data.deliveries?.length === 0, `count=${oldDriverActive.data.deliveries?.length}`);

test("G22 admin can deactivate driver", (await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "toggle_driver", driverId, active: false }) })).status === 200);
test("G23 admin can reactivate driver", (await admin.json("/api/admin/delivery", { method: "POST", body: JSON.stringify({ action: "toggle_driver", driverId, active: true }) })).status === 200);

const driversList = await admin.json("/api/admin/delivery?view=drivers");
test("G24 admin driver list loads", driversList.status === 200 && Array.isArray(driversList.data.drivers));
const historyList = await admin.json("/api/admin/delivery?view=history");
test("G25 admin delivery history loads", historyList.status === 200 && Array.isArray(historyList.data.history));
const pendingList = await admin.json("/api/admin/delivery?view=pending");
test("G26 admin pending assignments loads", pendingList.status === 200 && Array.isArray(pendingList.data.orders));
const activeList = await admin.json("/api/admin/delivery?view=active");
test("G27 admin active deliveries loads", activeList.status === 200 && Array.isArray(activeList.data.assignments));

// ─────────────────────────────────────────────────────────────
// 6. Cancel / refund workflow
// ─────────────────────────────────────────────────────────────
await customer.json("/api/cart", { method: "POST", body: JSON.stringify({ variantId: v1, qty: 2 }) });
const stockBeforeCancel = Number(sql(`SELECT stock FROM product_variants WHERE id='${v1}'`));
const order3 = await customer.json("/api/checkout", { method: "POST", body: JSON.stringify({ name: "Test Customer", email: customerEmail, phone: "9876543210", line1: "123 St", city: "Mumbai", state: "Maharashtra", pincode: "400001", method: "cod", coupon: "", notes: "", saveAddress: false, idempotencyKey: crypto.randomUUID() }) });
const orderId3 = sql(`SELECT id FROM orders WHERE order_number='${order3.data.orderNumber}'`);
test("H1 admin cancel order", (await admin.json("/api/admin/orders", { method: "PATCH", body: JSON.stringify({ id: orderId3, status: "cancelled" }) })).status === 200);
const stockAfterCancel = Number(sql(`SELECT stock FROM product_variants WHERE id='${v1}'`));
test("H2 stock restored after cancel", stockAfterCancel === stockBeforeCancel, `before=${stockBeforeCancel} after=${stockAfterCancel}`);
test("H3 cancel ledger recorded", Number(sql(`SELECT count(*) FROM inventory_transactions WHERE variant_id='${v1}' AND reason='order_cancelled'`)) >= 1);
test("H4 cancelled order status in DB", sql(`SELECT status FROM orders WHERE id='${orderId3}'`) === "cancelled");

await admin.json("/api/auth/logout", { method: "POST" });
test("H5 admin session invalidated after logout", (await admin.json("/api/admin/overview")).status === 403);

console.log(`\n== SUMMARY ==\npassed: ${passed}\nfailed: ${failed}\nblocked: ${blocked}`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(failed === 0 ? 0 : 1);
