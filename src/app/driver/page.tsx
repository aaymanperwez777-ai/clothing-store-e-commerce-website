import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { drivers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { DriverDashboard } from "@/components/driver-dashboard";

export const metadata: Metadata = { title: "Driver Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DriverPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 pt-28">
        <div className="surface-card w-full rounded-[2rem] p-10 text-center">
          <h1 className="text-2xl font-black">Driver Login</h1>
          <p className="mt-2 text-sm text-fog">Sign in with your driver account credentials.</p>
          <Link href="/account?next=/driver" className="btn btn-acid mt-6 w-full">Sign in</Link>
        </div>
      </div>
    );
  }

  // Check if user is a driver
  const [driver] = await db.select().from(drivers).where(and(eq(drivers.userId, user.id), eq(drivers.active, true))).limit(1);
  if (!driver) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 pt-28">
        <div className="surface-card w-full rounded-[2rem] p-10 text-center">
          <h1 className="text-2xl font-black">Access Denied</h1>
          <p className="mt-2 text-sm text-fog">This area is for authorised delivery drivers only.</p>
          <Link href="/" className="btn btn-ghost mt-6 w-full">Back to store</Link>
        </div>
      </div>
    );
  }

  return <DriverDashboard driverName={driver.name} />;
}
