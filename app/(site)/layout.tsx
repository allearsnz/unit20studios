import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { IntroOverlay } from "@/components/transition/IntroOverlay";

/**
 * Shell for all marketing/content pages, including the home page.
 *
 * The intro curtain sits here rather than in the root layout so it can't cover
 * `/admin`. It's a first-impression for someone arriving at the site; the owner
 * opening the dashboard is not that, and was waiting 1.35s behind a black
 * rectangle for it.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Preload the logo so the intro overlay's CSS mask paints on first frame */}
      <link rel="preload" as="image" href="/unit20-logo.png" />
      <IntroOverlay />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
