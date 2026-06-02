import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { ContactStrip } from "@/components/hire/ContactStrip";
import { ProductGrid } from "@/components/hire/ProductGrid";
import { productsByCategory, type Product } from "@/lib/products";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";
import {
  HIRE_EMAIL,
  HIRE_PHONE_DISPLAY,
  HIRE_PHONE_TEL,
  buildHireMailto,
} from "@/lib/hire-contact";

export const metadata: Metadata = {
  title: "Gear hire in Christchurch — DJ, sound & lighting",
  description:
    "Hire Pioneer DJ CDJs, mixers, QSC PA and event lighting across Christchurch. Day rates from $70+GST. Email hello@allears.nz or call 021 178 0355.",
  alternates: { canonical: "/hire" },
  openGraph: { title: "Unit 20 — Gear hire, Christchurch", url: "/hire" },
};

const DJ_PRODUCTS: Product[] = [
  ...productsByCategory("dj-player"),
  ...productsByCategory("dj-mixer"),
  ...productsByCategory("dj-all-in-one"),
];

const SOUND_PRODUCTS: Product[] = [
  ...productsByCategory("speaker"),
  ...productsByCategory("subwoofer"),
];

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

const fullProductionMailto = buildHireMailto({
  subject: "Full production enquiry",
});

export default function HirePage() {
  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: "DJ, sound & lighting hire — Christchurch",
            serviceType: "Audio and lighting equipment hire",
            path: "/hire",
            description:
              "DJ, sound and lighting hire across Christchurch — Pioneer DJ CDJs, QSC PA, LD Systems and full event production.",
          }),
          faqPageLd(HIRE_FAQS),
          breadcrumbLd([{ name: "Hire", path: "/hire" }]),
        ]}
      />

      {/* hero */}
      <Section className="pt-32 md:pt-40">
        <div className="max-w-3xl">
          <p className="eyebrow">Hire · Christchurch</p>
          <h1 className="display mt-4 text-text">
            DJ, sound &amp; lighting hire.
          </h1>
          <p className="lead mt-5 text-pretty">
            The same gear we trust in the studio, available across Christchurch.
            Pioneer DJ, QSC, LD Systems. Delivered or picked up, set up to play.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={buildHireMailto({ subject: "Hire enquiry" })}
            className="btn btn-primary"
          >
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

        {/* in-page nav */}
        <nav
          aria-label="Hire categories"
          className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 font-mono text-meta uppercase tracking-meta"
        >
          <a href="#dj-equipment" className="link text-text-muted hover:text-text">
            DJ equipment
          </a>
          <a href="#sound-equipment" className="link text-text-muted hover:text-text">
            Sound equipment
          </a>
          <a href="#lighting-equipment" className="link text-text-muted hover:text-text">
            Lighting
          </a>
        </nav>
      </Section>

      {/* 01 — DJ Equipment Hire */}
      <Section id="dj-equipment" className="border-t border-border">
        <SectionHeading
          eyebrow="DJ equipment hire"
          title="Pioneer DJ gear."
          lead="Industry-standard players and mixers. The same kit you'll meet in any Christchurch club booth."
        />
        <div className="mt-10">
          <ProductGrid products={DJ_PRODUCTS} priorityCount={3} />
        </div>
        <p className="mt-8 font-mono text-meta uppercase tracking-meta text-text-dim">
          Standard day rates. Multi-day, multi-unit and full backline packages on enquiry.
        </p>
      </Section>

      {/* 02 — Sound Equipment Hire */}
      <Section id="sound-equipment" className="border-t border-border">
        <SectionHeading
          eyebrow="Sound equipment hire"
          title="PA, tops and subs."
          lead="Active QSC and LD Systems boxes for events of any size. From a single Bluetooth top to a full club rig."
        />
        <div className="mt-10">
          <ProductGrid products={SOUND_PRODUCTS} />
        </div>
      </Section>

      {/* 03 — Lighting Equipment Hire (coming soon) */}
      <Section id="lighting-equipment" className="border-t border-border">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <SectionHeading
            eyebrow="Lighting equipment hire"
            title="Lighting."
          />
          <div>
            <div className="inline-flex items-center gap-3 border border-accent/40 bg-accent/5 px-4 py-2">
              <span className="size-2 animate-pulse rounded-full bg-accent" />
              <span className="font-mono text-meta uppercase tracking-meta text-accent">
                Coming soon
              </span>
            </div>
            <p className="lead mt-6 max-w-lg text-pretty">
              Moving heads, washes, hazers and control. The fixture list is being
              finalised — in the meantime, tell us the event and we'll spec a rig.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={buildHireMailto({ subject: "Lighting hire enquiry" })}
                className="btn btn-secondary"
              >
                <Mail className="size-4" aria-hidden /> Lighting enquiry
              </a>
            </div>
          </div>
        </div>
      </Section>

      {/* 04 — Full production (eye-catching hero, not a card) */}
      <section
        id="full-production"
        className="relative isolate overflow-hidden border-t border-border"
      >
        <Image
          src="/fullproduction.webp"
          alt="Crowd watching a live performance under the lit-up All Ears marquee stage"
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* darken + accent wash for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.75) 60%, rgba(10,10,10,0.92) 100%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 80% at 12% 95%, rgba(61,220,151,0.18), transparent 60%)",
          }}
          aria-hidden
        />

        <div className="container-page relative min-h-[78vh] py-24 md:min-h-[80vh] md:py-32">
          <div className="flex h-full flex-col justify-end">
            <p className="eyebrow text-accent">Full production</p>
            <h2 className="display mt-6 max-w-3xl text-text">
              We can run the whole night.
            </h2>
            <p className="lead mt-6 max-w-xl text-pretty text-text">
              Festivals, club shows, brand activations, private parties. Sound,
              lighting, staging, backline, crew. One supplier, one quote, on the
              ground in Christchurch and across the South Island.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={fullProductionMailto} className="btn btn-primary">
                <Mail className="size-4" aria-hidden /> Get a custom quote
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <a
                href={`tel:${HIRE_PHONE_TEL}`}
                className="btn btn-secondary"
                aria-label={`Call ${HIRE_PHONE_DISPLAY}`}
              >
                <Phone className="size-4" aria-hidden /> {HIRE_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
      </section>

      <ContactStrip
        eyebrow="Book"
        heading="Ready to book?"
        body="Email or call with your dates. We'll confirm availability, delivery and any extras."
        subject="Hire enquiry"
      />

      <Section>
        <SectionHeading eyebrow="FAQ" title="Hire FAQs" />
        <div className="mt-10">
          <Faq items={HIRE_FAQS} />
        </div>
      </Section>
    </>
  );
}
