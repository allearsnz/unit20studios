import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

/** Shell for all marketing/content pages. The hub (app/page.tsx) opts out. */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
