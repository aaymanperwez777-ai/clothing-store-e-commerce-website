import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const DOCS: Record<string, { title: string; sections: { h: string; body: string }[] }> = {
  shipping: {
    title: "Shipping Policy",
    sections: [
      { h: "Coverage", body: "We ship across India with trusted courier partners. Orders are packed within 1–2 business days and typically delivered within 3–6 business days depending on your PIN code." },
      { h: "Charges", body: "A flat shipping fee of ₹99 applies to orders below ₹1,499. Orders of ₹1,499 and above ship free. The store owner can update these values from the admin dashboard." },
      { h: "Tracking", body: "Once your order ships, a tracking number is added to your order — visible on your order page. You will also receive notifications on your account." },
      { h: "Delays", body: "During peak drops and festive periods, dispatch may take an extra 1–2 days. If your order is stuck for over 7 days, contact us with your order number." },
    ],
  },
  returns: {
    title: "Returns & Refunds",
    sections: [
      { h: "Size exchanges", body: "We offer a 7-day size exchange window from delivery, provided the item is unworn, unwashed and tags are intact." },
      { h: "How to request", body: "Email hello@example.com with your order number and the size you need. We will arrange a reverse pickup where serviceable." },
      { h: "Refunds", body: "Approved refunds are processed to the original payment method within 5–7 business days. COD orders are refunded via UPI/bank transfer after verification." },
      { h: "Non-returnable", body: "Items marked as final sale, and accessories such as caps, cannot be returned unless defective." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { h: "What we collect", body: "Name, email, phone, delivery address and order history — only what's needed to fulfil your orders and improve your experience." },
      { h: "How we use it", body: "Order processing, delivery updates, support, and — only if you subscribe — drop announcements. We never sell your data." },
      { h: "Cookies", body: "We use essential cookies for sessions and your shopping cart. No invasive tracking." },
      { h: "Security", body: "Passwords are stored only as strong salted hashes. Payments are processed by Razorpay; we never see or store your card details." },
      { h: "Your rights", body: "Email us to access, correct or delete your account data at any time." },
    ],
  },
  terms: {
    title: "Terms & Conditions",
    sections: [
      { h: "Orders", body: "An order is an offer to purchase. We may decline orders in cases of pricing errors, suspected fraud or stock unavailability — with a full refund where payment was taken." },
      { h: "Pricing", body: "All prices are in INR and include GST. Prices are verified on our server at the time of order." },
      { h: "Payments", body: "Online payments are processed securely by Razorpay. Cash on Delivery is available on eligible orders and may be disabled at the store's discretion." },
      { h: "Content", body: "All designs, photography and brand assets are the property of CLOTHING STORE and may not be reproduced without written permission." },
      { h: "Contact", body: "Questions about these terms: hello@example.com" },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const d = DOCS[doc];
  return d ? { title: d.title, alternates: { canonical: `/legal/${doc}` } } : { title: "Not found" };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const d = DOCS[doc];
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
      <p className="kicker">DEMO STORE · SAMPLE POLICIES</p>
      <h1 className="mt-2 text-4xl font-black tracking-tight">{d.title}</h1>
      <div className="mt-10 flex flex-col gap-6">
        {d.sections.map((s) => (
          <section key={s.h} className="surface-card !rounded-[1.8rem] p-7">
            <h2 className="font-black">{s.h}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-silver">{s.body}</p>
          </section>
        ))}
      </div>
      <Link href="/shop" className="btn btn-ghost mt-10">Back to shop</Link>
    </div>
  );
}
