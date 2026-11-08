# CLOTHING STORE — Premium Unisex Clothing E-Commerce

A complete, production-ready fashion e-commerce platform. Dark-luxury organic design system, real PostgreSQL inventory, secure checkout (Razorpay online payments + Cash on Delivery), customer accounts, and a premium admin dashboard.

## Tech stack

- **Next.js 16** (App Router, RSC) Â· React 19 Â· TypeScript (strict)
- **PostgreSQL** via **Drizzle ORM** (transactions, unique constraints, FK cascades)
- **Tailwind CSS v4** design system (organic radii, acid-lime accent on obsidian)
- **Razorpay** payment gateway (order creation, HMAC-SHA256 signature verification, signed webhooks)
- **bcryptjs** password hashing Â· httpOnly cookie sessions Â· zod input validation
- Automated end-to-end smoke suite: `scripts/smoke.mjs` (69 checks)

## Quick start

```bash
npm install
cp .env.example .env          # fill DATABASE_URL at minimum
npx drizzle-kit push          # create tables
npx tsx scripts/seed.ts       # sample catalogue + admin + demo customer
npm run dev                   # http://localhost:3000
```

**Seed credentials** (for development only):
Default credentials can be created using the `scripts/seed.ts` script for testing. In production, you must configure your admin user via environment variables.

| Role | Default Email (Dev Only) |
|---|---|
| Admin | `admin@funkyculture.in` |
| Demo customer | `demo@funkyculture.in` |

Coupon: `WELCOME10` â€” 10% off, min order â‚¹999.

## Payments

- **COD** works out of the box; configurable in Admin â†’ Content â†’ Shipping & COD.
- **Online payments** activate when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set (use `rzp_test_` keys for sandbox). Without keys the UI shows a clear "payments not configured" state â€” nothing is simulated.
- Webhook endpoint: `/api/razorpay/webhook` (configure in the Razorpay dashboard with `RAZORPAY_WEBHOOK_SECRET`).
- Prices, coupons and stock are **always** validated server-side; orders are idempotent.

## Admin dashboard

`/admin` (admin role only â€” enforced server-side on every endpoint):
Overview & analytics Â· **Product Studio** â€” upload product photos directly from your device (upload/replace/reorder/remove, first image = cover), set regular/sale pricing in â‚¹, define unlimited size Ã— colour Ã— stock variants visually, publish instantly, add unlimited products Â· Orders (status, tracking, cancel/restock, refunds) Â· Customers Â· Coupons Â· Inventory with ledger Â· Review moderation Â· Homepage content (hero, promo banner, shipping rules, contact, Instagram gallery, testimonials, categories).

**Uploaded photos** are stored in `data/uploads/` on the server filesystem and served at runtime through `/uploads/â€¦` (5 MB max; real file type verified by magic bytes, admin-only, path-traversal-proof). For serverless production hosts (e.g. Vercel) where the filesystem is ephemeral, swap `src/app/api/admin/upload/route.ts` to S3/Cloudinary â€” one file change.

## Scripts

```bash
npm run build && npm start    # production
node scripts/smoke.mjs        # E2E tests (server must be running)
npx tsx scripts/seed.ts       # reset + reseed demo data (destructive)
```

## âš ï¸ Catalogue data

Seeded products are **placeholders** generated for platform demonstration. Instagram content could not be auto-imported (no authorised API access), so nothing was scraped or invented from the live account. **The store owner must verify/replace names, prices, sizes, stock and photography** (their own authorised images) via Admin â†’ Products before launch. Always update prices from the admin dashboard.

## Database Migrations

This project uses Drizzle ORM.
- **Development**: Use `npx drizzle-kit push` to sync schema changes directly to your local/development database.
- **Production**:
  1. Generate migration files: `npx drizzle-kit generate`.
  2. Review generated SQL in the `drizzle/` folder.
  3. Apply migrations to production: `npx drizzle-kit migrate` (ensure `DATABASE_URL` is set to production).
  4. Always backup your production database before running migrations.

## Deployment

1. Provision PostgreSQL (Neon/RDS/Supabase) â†’ set `DATABASE_URL`.
2. Set env vars (see `.env.example`). **Security: Ensure `ADMIN_PASSWORD` is set to a unique, strong value.**
3. Apply migrations to production: `npx tsx src/db/migrate.ts` (ensure `DATABASE_URL` is set to production).
4. Seed your initial catalogue: `npx tsx scripts/seed.ts` (WARNING: This script wipes existing data in the DB. Use only for fresh installations).
5. Deploy to Vercel/Node host Â· run `npm run build` in CI.
6. Razorpay: complete KYC, add live keys, register the webhook URL.
7. Cloudinary: Ensure `CLOUDINARY_URL` is set for persistent production image storage.

## Backup & Recovery

Before performing any database migrations or running the seed script on a live database:
1. Perform a full backup of your PostgreSQL database using `pg_dump`.
2. Verify that your environment variables are correctly pointed to the target database.
3. Test migrations in a staging environment first.
