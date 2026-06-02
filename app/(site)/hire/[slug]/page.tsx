import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { ProductGrid } from "@/components/hire/ProductGrid";
import { ContactStrip } from "@/components/hire/ContactStrip";
import { HIRE_SERVICES, getHireService } from "@/lib/hire";
import {
  CDJ_PAGE_DJ_ORDER,
  productBySlug,
  productsByCategory,
  type Product,
} from "@/lib/products";
import {
  HIRE_EMAIL,
  HIRE_PHONE_DISPLAY,
  HIRE_PHONE_TEL,
  buildHireMailto,
} from "@/lib/hire-contact";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";
import { site } from "@/lib/site";

const HIRE_FAQS = [
  {
    q: "How do I book?",
    a: `Email ${HIRE_EMAIL} or call ${HIRE_PHONE_DISPLAY} with your dates and gear. We'll confirm availability and send a quote.`,
  },
  {
    q: "Are these per-day rates?",
    a: "Yes, +GST. Multi-day and weekly discounts available — just ask.",
  },
  {
    q: "Do you deliver?",
    a: "Within Christchurch, yes. Delivery and pickup fees depend on the package and are included with most full backline hires.",
  },
  {
    q: "Can I add lighting, staging, or a sound tech?",
    a: "Yes. We run full event production through All Ears. Mention what you need in your enquiry.",
  },
  {
    q: "What's the deposit?",
    a: "A bond may apply on higher-value hires. We'll let you know when we send the quote.",
  },
];

export function generateStaticParams() {
  return HIRE_SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getHireService(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.description,
    alternates: { canonical: `/hire/${service.slug}` },
    openGraph: {
      title: service.title,
      description: service.description,
      url: `/hire/${service.slug}`,
    },
  };
}

/**
 * For cdj-hire-christchurch we want DJ players + mixers + all-in-one rendered
 * in a specific cross-category order. Everywhere else just uses category order.
 */
function djSectionProducts(slug: string): Product[] {
  if (slug === "cdj-hire-christchurch") {
    return CDJ_PAGE_DJ_ORDER
      .map((s) => productBySlug(s))
      .filter((p): p is Product => Boolean(p));
  }
  return ["dj-player", "dj-mixer", "dj-all-in-one"]
    .flatMap((c) => productsByCategory(c as Product["category"]));
}

function paSectionProducts(): Product[] {
  return [
    ...productsByCategory("speaker"),
    ...productsByCategory("subwoofer"),
  ];
}

export default async function HireServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getHireService(slug);
  if (!service) notFound();

  const wantsDjSection = service.categories.some((c) =>
    ["dj-player", "dj-mixer", "dj-all-in-one"].includes(c),
  );
  const wantsPaSection = service.categories.some((c) =>
    ["speaker", "subwoofer"].includes(c),
  );
  const wantsLighting = service.slug === "lighting-hire-christchurch";

  const djProducts = wantsDjSection ? djSectionProducts(service.slug) : [];
  const paProducts = wantsPaSection ? paSectionProducts() : [];

  const heroMailto = buildHireMailto({ subject: `Hire enquiry: ${service.shortTitle}` });

  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: service.title,
            serviceType: "Equipment hire",
            path: `/hire/${service.slug}`,
            description: service.description,
          }),
          faqPageLd(HIRE_FAQS),
          breadcrumbLd([
            { name: "Hire", path: "/hire" },
            { name: service.shortTitle, path: `/hire/${service.slug}` },
          ]),
        ]}
      />

      {/* hero */}
      <Section className="pt-32 md:pt-40">
        <div className="flex flex-col gap-3 font-mono text-meta uppercase tracking-meta text-text-dim">
          <nav aria-label="Breadcrumb">
            <Link href="/" className="link hover:text-text-muted">Home</Link>
            <span aria-hidden> / </span>
            <Link href="/hire" className="link hover:text-text-muted">Hire</Link>
            <span aria-hidden> / </span>
            <span className="text-text-muted">{service.shortTitle}</span>
          </nav>
        </div>
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow">Hire</p>
          <h1 className="display mt-4 text-text">{service.title}</h1>
          <p className="lead mt-5 text-pretty">{service.lede}</p>
          <p className="mono mt-4 text-meta uppercase tracking-meta text-accent">
            {service.fromLabel}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={heroMailto} className="btn btn-primary">
            <Mail className="size-4" aria-hidden /> Email to book
          </a>
          <a
            href={`tel:${HIRE_PHONE_TEL}`}
            className="btn btn-secondary"
            aria-label={`Call ${HIRE_PHONE_DISPLAY}`}
          >
            <Phone className="size-4" aria-hidden /> Call {HIRE_PHONE_DISPLAY}
          </a>
        </div>
      </Section>

      {/* DJ players + mixers + all-in-one */}
      {djProducts.length > 0 ? (
        <Section className="border-t border-border">
          <SectionHeading
            eyebrow="01 — DJ players & mixers"
            title="Pioneer DJ gear"
            lead="Run a club-spec setup with the same gear used at Boiler Room, R&V and most Christchurch venues."
          />
          <div className="mt-10">
            <ProductGrid products={djProducts} priorityCount={3} />
          </div>
          <p className="mt-8 font-mono text-meta uppercase tracking-meta text-text-dim">
            Standard day rates. Multi-day, multi-unit and full backline packages on enquiry.
          </p>
        </Section>
      ) : null}

      {/* PA section */}
      {paProducts.length > 0 ? (
        <Section className="border-t border-border">
          <SectionHeading
            eyebrow={wantsDjSection ? "02 — Add a speaker" : "01 — Speakers & subs"}
            title={wantsDjSection ? "PA for your DJ setup" : "Active PA"}
            lead={
              wantsDjSection
                ? "Active 12-inch tops and 18-inch subs that match the gear above. Add a stand or go Bluetooth."
                : "Active 12-inch tops and an 18-inch sub. Add a stand or go Bluetooth."
            }
          />
          <div className="mt-10">
            <ProductGrid
              products={paProducts}
              priorityCount={wantsDjSection ? 0 : 3}
            />
          </div>
        </Section>
      ) : null}

      {/* larger systems */}
      {service.showLargerSystems ? (
        <Section className="border-t border-border">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <SectionHeading
              eyebrow={
                wantsDjSection && wantsPaSection ? "03 — Larger systems" : "02 — Larger systems"
              }
              title="Festival and full-club rigs"
              lead="For full festival and club-spec sound we run RCF HDL 30 line arrays and TTL6 systems with backline support. Tell us your venue, headcount and any rider notes and we'll quote a tailored package."
            />
            <div className="flex items-end">
              <a
                href={buildHireMailto({ subject: "Quote: larger sound system" })}
                className="btn btn-primary"
              >
                <Mail className="size-4" aria-hidden /> Email for a custom quote
              </a>
            </div>
          </div>
        </Section>
      ) : null}

      {/* lighting placeholder body */}
      {wantsLighting ? (
        <Section className="border-t border-border">
          <SectionHeading
            eyebrow="01 — Fixtures"
            title="Inventory list coming soon"
            lead="Detailed fixture list is being finalised. For now, please get in touch with your event details — venue, dates, rough headcount, and the look you're after — and we'll spec a package."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={buildHireMailto({ subject: "Lighting hire enquiry" })}
              className="btn btn-primary"
            >
              <Mail className="size-4" aria-hidden /> Lighting enquiry
            </a>
            <a
              href={`tel:${HIRE_PHONE_TEL}`}
              className="btn btn-secondary"
              aria-label={`Call ${HIRE_PHONE_DISPLAY}`}
            >
              <Phone className="size-4" aria-hidden /> {HIRE_PHONE_DISPLAY}
            </a>
          </div>
        </Section>
      ) : null}

      <ContactStrip
        eyebrow="Book"
        heading="Ready to book?"
        body="Email or call us with your dates. We'll confirm availability, delivery, and any extras."
        subject={`Hire enquiry: ${service.shortTitle}`}
      />

      {/* FAQ */}
      <Section>
        <SectionHeading eyebrow="FAQ" title="Hire FAQs" />
        <div className="mt-10">
          <Faq items={HIRE_FAQS} />
        </div>
      </Section>

      {/* cross-link */}
      <Section className="border-t border-border">
        <Link
          href="/studio"
          className="link inline-flex items-center gap-2 font-mono text-meta uppercase tracking-meta text-accent"
        >
          Looking for the studio? Practice on this gear at Unit 20 Studio
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <p className="mt-2 font-mono text-meta uppercase tracking-meta text-text-dim">
          {site.name} · {site.address.locality}
        </p>
      </Section>
    </>
  );
}
