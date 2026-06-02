import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ContactStrip } from "@/components/hire/ContactStrip";
import { HIRE_SERVICES } from "@/lib/hire";
import { breadcrumbLd, serviceLd } from "@/lib/seo";
import { buildHireMailto } from "@/lib/hire-contact";

export const metadata: Metadata = {
  title: "Gear hire in Christchurch — CDJs, mixers, PA & lighting",
  description:
    "Hire Pioneer DJ CDJs, mixers, QSC PA and lighting across Christchurch. Day rates from $70+GST. Email or call to book.",
  alternates: { canonical: "/hire" },
  openGraph: { title: "Unit 20 — Gear hire, Christchurch", url: "/hire" },
};

const FULL_PRODUCTION: { title: string; lede: string; href: string } = {
  title: "Full production",
  lede: "Multi-day events, festivals, club shows.",
  href: buildHireMailto({ subject: "Quote: full production" }),
};

export default function HirePage() {
  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: "DJ & event equipment hire",
            serviceType: "Audio and lighting equipment hire",
            path: "/hire",
            description:
              "DJ and event gear hire across Christchurch — CDJs, mixers, PA, sound and lighting.",
          }),
          breadcrumbLd([{ name: "Hire", path: "/hire" }]),
        ]}
      />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="Hire · Christchurch"
          title="The booth, out in the wild."
          lead="The same gear we trust in the studio, available across Christchurch. CDJs, mixers, PA, sound and lighting — delivered, set up, and collected. One supplier for the whole night."
        />

        <ul className="mt-14 grid gap-4 md:grid-cols-2">
          {HIRE_SERVICES.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/hire/${s.slug}`}
                className="card card-hover group flex h-full flex-col gap-3 p-7 md:p-9"
              >
                <span className="eyebrow">{s.shortTitle}</span>
                <h2 className="font-display text-h2 font-semibold text-text">
                  {s.title}
                </h2>
                <p className="lead text-pretty">{s.lede}</p>
                <div className="mt-auto flex items-baseline justify-between pt-6">
                  <span className="mono text-meta uppercase tracking-meta text-accent">
                    {s.fromLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 font-mono text-meta uppercase tracking-meta text-text-muted transition-colors group-hover:text-accent">
                    View
                    <ArrowRight
                      className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </div>
              </Link>
            </li>
          ))}
          <li>
            <a
              href={FULL_PRODUCTION.href}
              className="card card-hover group flex h-full flex-col gap-3 p-7 md:p-9"
            >
              <span className="eyebrow">Custom quote</span>
              <h2 className="font-display text-h2 font-semibold text-text">
                {FULL_PRODUCTION.title}
              </h2>
              <p className="lead text-pretty">{FULL_PRODUCTION.lede}</p>
              <div className="mt-auto flex items-baseline justify-between pt-6">
                <span className="mono text-meta uppercase tracking-meta text-accent">
                  Get a quote
                </span>
                <span className="inline-flex items-center gap-2 font-mono text-meta uppercase tracking-meta text-text-muted transition-colors group-hover:text-accent">
                  Email
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </span>
              </div>
            </a>
          </li>
        </ul>
      </Section>

      <ContactStrip
        eyebrow="Book"
        heading="Not sure what you need?"
        body="Tell us the event, the room and the date. We'll spec a package and send a quote — no guesswork."
        subject="Hire enquiry"
      />
    </>
  );
}
