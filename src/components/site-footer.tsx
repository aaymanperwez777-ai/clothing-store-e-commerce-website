import Link from "next/link";
import Image from "next/image";
import { getSetting, DEFAULT_CONTACT, DEFAULT_SOCIAL, type ContactSettings, type SocialSettings } from "@/lib/settings";

export async function SiteFooter() {
  const contact = await getSetting<ContactSettings>("contact", DEFAULT_CONTACT);
  const social = await getSetting<SocialSettings>("social", DEFAULT_SOCIAL);

  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-12 sm:px-6">
      <div className="surface-card grain relative overflow-hidden rounded-[2.5rem] px-7 py-14 sm:px-12">
        {/* Subtle ambient glow */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/[0.02] blur-[80px]" />

        <div className="relative grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            {/* Circular logo in footer */}
            <div className="flex items-center gap-3.5">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10 p-1 flex items-center justify-center bg-black">
                <Image
                  src="/logo.svg"
                  alt="CLOTHING STORE"
                  fill
                  sizes="48px"
                  className="object-contain p-1 scale-125"
                />
              </div>
              <div>
                <p className="text-lg font-black uppercase tracking-[0.14em]">
                  CLOTHING STORE
                </p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-fog">Everyday fashion</p>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-fog">
              Explore everyday styles and clothing for every occasion.
            </p>{social.instagram ? (
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-5 !py-2.5 !text-[13px]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>
              Instagram
            </a>) : null}
          </div>

          <nav aria-label="Shop" className="text-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-fog">Shop</p>
            <ul className="flex flex-col gap-2.5 text-fog">
              <li><Link className="transition hover:text-ivory" href="/shop">All products</Link></li>
              <li><Link className="transition hover:text-ivory" href="/shop?sort=new">New arrivals</Link></li>
              <li><Link className="transition hover:text-ivory" href="/shop?sort=featured">Best sellers</Link></li>
              <li><Link className="transition hover:text-ivory" href="/cart">Cart</Link></li>
              <li><Link className="transition hover:text-ivory" href="/account">Track my order</Link></li>
            </ul>
          </nav>

          <nav aria-label="Policies" className="text-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-fog">Help</p>
            <ul className="flex flex-col gap-2.5 text-fog">
              <li><Link className="transition hover:text-ivory" href="/legal/shipping">Shipping policy</Link></li>
              <li><Link className="transition hover:text-ivory" href="/legal/returns">Returns &amp; refunds</Link></li>
              <li><Link className="transition hover:text-ivory" href="/legal/privacy">Privacy policy</Link></li>
              <li><Link className="transition hover:text-ivory" href="/legal/terms">Terms &amp; conditions</Link></li>
            </ul>
          </nav>

          <div className="text-sm">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-fog">Contact</p>
            <ul className="flex flex-col gap-2.5 text-fog">
              <li><a className="transition hover:text-ivory" href={`mailto:${contact.email}`}>{contact.email}</a></li>
              <li><a className="transition hover:text-ivory" href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a></li>
              <li>{contact.address}</li>
              <li>{contact.city}</li>
            </ul>
          </div>
        </div>

        <div className="relative mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-7 text-xs text-fog/70 sm:flex-row">
          <p>© {new Date().getFullYear()} CLOTHING STORE. All rights reserved.</p>
          <p>Premium unisex streetwear · India · Prices in INR (₹)</p>
        </div>
      </div>
    </footer>
  );
}
