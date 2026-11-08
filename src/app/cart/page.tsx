import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";
import { RecentlyViewed } from "@/components/recent";

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review your CLOTHING STORE cart and checkout securely.",
  robots: { index: false },
};

export default function Cart() {
  return (
    <>
      <CartPage />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <RecentlyViewed />
      </div>
      <div className="h-16" />
    </>
  );
}
