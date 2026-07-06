import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { AdSenseScript } from "@/components/AdSense";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

// Display face: Fraunces — a warm, characterful serif for game titles, room codes
// and the hero. It reads "well-worn card-table plaque," not "SaaS landing page."
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Body/UI face: Inter — quiet, legible at 375px, gets out of the way.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const TITLE = "Houseruled — your rules, your game, any deck";
const DESCRIPTION =
  "A free-forever card table you play with friends over a link. Bring the deck, bring your house rules — no app, no account, no catch.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Houseruled",
  },
  description: DESCRIPTION,
  applicationName: "Houseruled",
  formatDetection: { telephone: false, email: false, address: false },
  keywords: [
    "card games",
    "online card games",
    "play cards with friends",
    "house rules",
    "custom card games",
    "multiplayer card game",
    "free card games",
    "War card game",
    "Go Fish",
    "Crazy Eights",
    "Blackjack",
    "no download card game",
  ],
  authors: [{ name: "Karthik" }],
  creator: "Karthik",
  category: "games",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Installs cleanly to an iOS home screen as a full-screen web app.
  appleWebApp: {
    capable: true,
    title: "Houseruled",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Houseruled",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: "Your rules. Your game. Any deck.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F3D2E",
  width: "device-width",
  initialScale: 1,
  // Let the felt bleed under the notch / home indicator when installed.
  viewportFit: "cover",
};

// Structured data: helps search engines understand this is a free web game.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Houseruled",
  url: SITE_URL,
  applicationCategory: "GameApplication",
  operatingSystem: "Any (web browser)",
  description: DESCRIPTION,
  browserRequirements: "Requires a modern web browser. No download required.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Everything sits above the fixed felt-texture overlay (z-0).
            Safe-area padding keeps content clear of the notch / home indicator
            when installed as a standalone app. */}
        <div
          className="relative z-10 flex min-h-dvh flex-col"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {children}
        </div>
        <AdSenseScript />
      </body>
    </html>
  );
}
