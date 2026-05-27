import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { HIRE_SERVICES } from "@/lib/hire";
import { breadcrumbLd, serviceLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Gear hire in Christchurch — CDJs, mixers, PA & lighting",
  description:
    "Hire DJ and event gear across Christchurch — Pioneer CDJ-3000s, DJM mixers, PA systems, sound and lighting. Delivered or collected, set up ready to go.",
  alternates: { canonical: "/hire" },
  openGraph: { title: "Unit 20 — Gear hire, Christchurch", url: "/hire" },
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
          lead="The same gear we trust in the studio, available to hire across Christchurch. CDJs, mixers, PA, sound and lighting — delivered, set up, and collected. One supplier for the whole night."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {HIRE_SERVICES.map((s) => (
            <Link
              key={s.slug}
              href={`/hire/${s.slug}`}
              className="card card-hover group relative overflow-hidden p-7 md:p-9"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-80"
                style={{ background: s.gradient }}
                aria-hidden
              />
              <div className="relative">
                <h2 className="font-display text-h2 font-semibold text-text">{s.nav}</h2>
                <p className="lead mt-3 max-w-sm text-pretty">{s.intro}</p>
                <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-accent">
                  View {s.nav.toLowerCase()}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <SectionHeading
            title="Not sure what you need?"
            lead="Tell us the event, the room and the date. We'll spec a package and send a quote — no guesswork."
          />
          <Link href="/contact?subject=Hire" className="btn btn-primary shrink-0">
            Get a quote
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}
