import type { Metadata } from "next";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSetting, DEFAULT_SHIPPING, type ShippingSettings } from "@/lib/settings";
import { CheckoutForm, type PrefillAddress } from "@/components/checkout-form";

export const metadata: Metadata = {
  title: "Secure Checkout",
  description: "Complete your CLOTHING STORE order with UPI, cards, netbanking or Cash on Delivery.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await getSessionUser();
  if (!user) redirect("/account");
  const shipping = await getSetting<ShippingSettings>("shipping", DEFAULT_SHIPPING);

  let prefill: PrefillAddress | null = null;
  if (user) {
    const addr = await db.select().from(addresses).where(eq(addresses.userId, user.id)).limit(1);
    if (addr[0]) {
      prefill = {
        name: addr[0].fullName,
        phone: addr[0].phone,
        line1: addr[0].line1,
        line2: addr[0].line2 ?? "",
        city: addr[0].city,
        state: addr[0].state,
        pincode: addr[0].pincode,
      };
    } else {
      prefill = { name: user.name, phone: user.phone ?? "", line1: "", line2: "", city: "", state: "", pincode: "" };
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6">
      <p className="kicker">Almost yours</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">
        Check<span className="font-editorial italic font-normal text-fog">out</span>
      </h1>
      <CheckoutForm
        email={user?.email ?? ""}
        prefill={prefill}
        codEnabled={shipping.codEnabled}
        shippingFee={shipping.fee}
        freeOver={shipping.freeOver}
        estimate={shipping.estimate}
      />
    </div>
  );
}
