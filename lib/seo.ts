import { site } from "./site";

export function absUrl(path: string): string {
  return path.startsWith("http") ? path : `${site.url}${path}`;
}

/** FAQPage structured data from a list of Q/A pairs. */
export function faqPageLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}

/** BreadcrumbList structured data. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

/** Service structured data with optional priced offers. */
export function serviceLd({
  name,
  serviceType,
  path,
  description,
  offers,
}: {
  name: string;
  serviceType: string;
  path: string;
  description?: string;
  offers?: { name: string; price: string; url?: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType,
    ...(description ? { description } : {}),
    url: absUrl(path),
    areaServed: { "@type": "City", name: "Christchurch" },
    provider: { "@type": "Organization", name: site.name, url: site.url },
    ...(offers
      ? {
          offers: offers.map((o) => ({
            "@type": "Offer",
            name: o.name,
            price: o.price,
            priceCurrency: "NZD",
            ...(o.url ? { url: absUrl(o.url) } : {}),
          })),
        }
      : {}),
  };
}
