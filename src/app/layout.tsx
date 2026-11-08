import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreIntro } from "@/components/store-intro";
import { CursorSpotlight } from "@/components/motion";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "CLOTHING STORE — Everyday Fashion",
    template: "%s · CLOTHING STORE",
  },
  description:
    "Shop oversized fits, heavyweight cotton T-shirts and unisex everyday streetwear at CLOTHING STORE.",
  keywords: ["clothing store", "online fashion", "everyday clothing", "fashion collections"],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "CLOTHING STORE",
    title: "CLOTHING STORE — Everyday Fashion",
    description: "Discover oversized fits, heavyweight cotton T-shirts and everyday streetwear.",
    images: [{ url: "/logo.svg", width: 800, height: 800, alt: "CLOTHING STORE logo" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${space.variable} ${instrument.variable}`}>
      <head>
        {/* Inline blocking script — runs before ANY paint.
            Sets data-fc-intro on <html> so the CSS can instantly
            hide the preload shield on non-intro pages. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var h=location.pathname==='/';var s=sessionStorage.getItem('fc_intro_seen')==='true';document.documentElement.dataset.fcIntro=h&&!s?'play':'skip'}catch(e){document.documentElement.dataset.fcIntro='skip'}})()`,
          }}
        />
      </head>
      <body>

        {/* Static black shield — inline style ensures it's opaque from the very first
            paint, before any JS or CSS loads. The intro component removes it. */}
        <div
          id="fc-intro-preload"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 199,
            background: "#000",
          }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-acid focus:px-5 focus:py-2 focus:text-acid-ink focus:font-bold"
        >
          Skip to content
        </a>
        <StoreIntro />
        <CursorSpotlight />
        <CartProvider>
          <SiteHeader />
          <main id="main" className="relative z-10">{children}</main>
        </CartProvider>
        <div className="relative z-10">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
