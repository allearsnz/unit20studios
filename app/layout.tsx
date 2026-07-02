import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@/components/analytics/Analytics";
import { IntroOverlay } from "@/components/transition/IntroOverlay";
import "./globals.css";

// Display / headings font. Currently Geist Mono as a free stand-in for the
// Unit 20 brand font, PP Supply Mono.
// SWAP TO THE REAL FONT: drop the licensed files in app/fonts/ and replace this
// loader with next/font/local, keeping `variable: "--font-supply"`. e.g.
//   import localFont from "next/font/local";
//   const supply = localFont({ variable: "--font-supply", src: [
//     { path: "./fonts/PPSupplyMono-Regular.woff2", weight: "400" },
//     { path: "./fonts/PPSupplyMono-Medium.woff2",  weight: "500" },
//   ]});
// Nothing else needs to change.
const supply = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-supply",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.unit20.nz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unit 20 — DJ practice studio, gear hire & venue · Christchurch",
    template: "%s · Unit 20",
  },
  description:
    "Practice on real club gear, hire production equipment, and host events at Unit 20 — Christchurch's underground DJ studio, hire house and venue.",
  applicationName: "Unit 20",
  openGraph: {
    type: "website",
    locale: "en_NZ",
    siteName: "Unit 20",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-NZ"
      className={`${supply.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="flex min-h-dvh flex-col bg-bg text-text antialiased">
        {/* Preload the logo so the intro overlay's CSS mask paints on first frame */}
        <link rel="preload" as="image" href="/unit20-logo.png" />
        <IntroOverlay />
        <a
          href="#main"
          className="sr-only z-[100] rounded-sm bg-accent px-4 py-2 font-mono text-sm text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
