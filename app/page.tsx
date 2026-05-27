import type { Metadata } from "next";
import { Hub } from "@/components/master-hub/Hub";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Unit 20 — Studio, Hire & Venue · Christchurch",
  description:
    "Practice on real club gear, hire production equipment, and put on a night. Unit 20 is Christchurch's underground DJ studio, gear-hire house and event venue.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Unit 20 — Studio, Hire & Venue",
    description:
      "Christchurch's underground DJ studio, gear-hire house and event venue.",
    url: "/",
  },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  legalName: site.legalName,
  url: site.url,
  email: site.email,
  ...(site.phone ? { telephone: site.phone } : {}),
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.street,
    addressLocality: site.address.locality,
    addressRegion: site.address.region,
    postalCode: site.address.postalCode,
    addressCountry: site.address.country,
  },
  sameAs: [site.social.instagram],
  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "DJ practice studio hire",
        serviceType: "DJ practice studio",
        areaServed: "Christchurch, New Zealand",
        url: `${site.url}/studio`,
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "DJ & PA equipment hire",
        serviceType: "Audio and lighting equipment hire",
        areaServed: "Christchurch, New Zealand",
        url: `${site.url}/hire`,
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Event venue",
        serviceType: "Event venue",
        areaServed: "Christchurch, New Zealand",
        url: site.venueUrl,
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd} />

      {/* minimal brand mark — not a nav; the hub is purely a 2-way selector */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-7">
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.32em] text-text-muted">
          <span className="block h-1.5 w-1.5 bg-accent" aria-hidden />
          Unit 20
        </span>
      </div>

      <main id="main">
        <h1 className="sr-only">
          Unit 20 — DJ practice studio, gear hire and event venue in
          Christchurch
        </h1>
        <Hub />
      </main>
    </>
  );
}
