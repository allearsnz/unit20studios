import type { Metadata } from "next";
import Image from "next/image";
import { Hub } from "@/components/master-hub/Hub";
import { JsonLd } from "@/components/seo/JsonLd";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Unit 20 — DJ studio & equipment hire · Christchurch",
  description:
    "Practice on real club gear and hire production equipment. Unit 20 is Christchurch's underground DJ studio and equipment hire house.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Unit 20 — DJ studio & equipment hire",
    description:
      "Christchurch's underground DJ studio and equipment hire house.",
    url: "/",
  },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  "@id": `${site.url}/#business`,
  name: site.name,
  legalName: site.legalName,
  description: site.tagline,
  url: site.url,
  image: `${site.url}/opengraph-image`,
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
  geo: {
    "@type": "GeoCoordinates",
    latitude: site.geo.lat,
    longitude: site.geo.lng,
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
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd} />

      {/* brand mark — the hub is purely a 2-way selector, no nav */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-7 md:pt-9">
        <Image
          src="/unit20-logo.png"
          alt="Unit 20"
          width={150}
          height={33}
          priority
          className="h-auto w-[116px] opacity-95 md:w-[150px]"
        />
      </div>

      <main id="main">
        <h1 className="sr-only">
          Unit 20 — DJ studio and equipment hire in Christchurch
        </h1>
        <Hub />
      </main>
    </>
  );
}
