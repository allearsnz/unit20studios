import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { HIRE_SERVICES, getHireService } from "@/lib/hire";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";

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
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: { canonical: `/hire/${service.slug}` },
    openGraph: { title: service.metaTitle, description: service.metaDescription, url: `/hire/${service.slug}` },
  };
}

export default async function HireServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getHireService(slug);
  if (!service) notFound();

  const related = service.related
    .map((r) => getHireService(r))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: service.h1,
            serviceType: "Equipment hire",
            path: `/hire/${service.slug}`,
            description: service.metaDescription,
          }),
          faqPageLd(service.faqs),
          breadcrumbLd([
            { name: "Hire", path: "/hire" },
            { name: service.nav, path: `/hire/${service.slug}` },
          ]),
        ]}
      />

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: service.gradient }} aria-hidden />
        <div className="container-page relative pb-16 pt-32 md:pb-20 md:pt-40">
          <Link href="/hire" className="link font-mono text-xs uppercase tracking-meta text-text-muted">
            ← All hire
          </Link>
          <h1 className="display mt-5 max-w-3xl text-text">{service.h1}</h1>
          <p className="lead mt-6 max-w-xl text-pretty">{service.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/contact?subject=Hire&gear=${encodeURIComponent(service.nav)}`} className="btn btn-primary">
              Get a quote
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/hire" className="btn btn-secondary">
              More hire options
            </Link>
          </div>
        </div>
      </section>

      {/* gear */}
      <Section>
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <SectionHeading eyebrow="The gear" title="What you get." lead={service.body} />
          <ul className="-mt-2">
            {service.gear.map((g, i) => (
              <li
                key={g.name}
                className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-border py-6 first:border-t-0 md:gap-x-8"
              >
                <span className="font-mono text-meta tracking-meta text-text-dim">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-h3 font-semibold text-text">{g.name}</h3>
                  <p className="lead mt-2 max-w-md text-pretty">{g.spec}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* pricing + quote */}
      <Section className="border-t border-border">
        <div className="flex flex-col items-start gap-6 rounded-sm border border-border bg-bg-elev p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div className="flex items-start gap-4">
            <Check className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="h3 text-text">{service.priceNote}</h2>
              <p className="lead mt-2 max-w-md">
                Delivery, setup and collection across Christchurch. Refundable bond and ID on hire.
              </p>
            </div>
          </div>
          <Link
            href={`/contact?subject=Hire&gear=${encodeURIComponent(service.nav)}`}
            className="btn btn-primary shrink-0"
          >
            Get a quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>

      {/* faqs */}
      <Section className="border-t border-border">
        <SectionHeading eyebrow="FAQ" title={`${service.nav} — the details.`} />
        <div className="mt-10">
          <Faq items={service.faqs} />
        </div>
      </Section>

      {/* related */}
      <Section className="border-t border-border">
        <SectionHeading eyebrow="Also available" title="Round out the rig." />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {related.map((r) => (
            <Link key={r.slug} href={`/hire/${r.slug}`} className="card card-hover group flex items-center justify-between gap-4 p-6">
              <span className="font-display text-h3 font-semibold text-text">{r.nav}</span>
              <ArrowUpRight className="h-5 w-5 text-text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
