import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { CDJStage } from "@/components/three/CDJStage";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { PRICING_TIERS, calcPriceCents } from "@/lib/pricing";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "The Studio — practice on real club gear",
  description:
    "A DJ practice studio in central Christchurch: twin Pioneer CDJ-3000s, a club mixer and honest monitoring. Book by the hour, 7am–midnight, from $35/hr off-peak.",
  alternates: { canonical: "/studio" },
  openGraph: { title: "Unit 20 — The Studio", url: "/studio" },
};

const GEAR = [
  {
    n: "01",
    name: "2× Pioneer CDJ-3000",
    spec: "The flagship multiplayers. 9-inch touchscreens, beat jump, key sync — the exact decks you'll meet in the booth.",
  },
  {
    n: "02",
    name: "Pioneer DJM-A9",
    spec: "Club-standard four-channel mixer. Learn the board that actually runs the night, not a controller approximation.",
  },
  {
    n: "03",
    name: "Honest monitoring",
    spec: "Full-range monitors tuned to tell the truth. Mix at volume and hear every transition land — or not.",
  },
  {
    n: "04",
    name: "The room",
    spec: "Low light, treated walls, a couch and decent air. Set up like a real booth so practice feels like the gig.",
  },
];

const small = PRICING_TIERS[0];
const large = PRICING_TIERS[1];

const serviceLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "DJ practice studio hire",
  serviceType: "DJ practice studio",
  url: `${site.url}/studio`,
  areaServed: { "@type": "City", name: "Christchurch" },
  provider: {
    "@type": "Organization",
    name: site.name,
    url: site.url,
  },
  offers: PRICING_TIERS.map((t) => ({
    "@type": "Offer",
    name: `${t.label} — off-peak hour`,
    price: (calcPriceCents(t, 1, false) / 100).toFixed(2),
    priceCurrency: "NZD",
    url: `${site.url}/studio/book`,
  })),
};

export default function StudioPage() {
  return (
    <>
      <JsonLd data={serviceLd} />

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container-page grid items-center gap-10 pb-16 pt-32 md:min-h-[88vh] md:grid-cols-[1.05fr_0.95fr] md:gap-6 md:pb-24 md:pt-36">
          <div className="max-w-xl">
            <p className="eyebrow">Studio / Hire · Christchurch</p>
            <h1 className="display mt-5">
              Real club gear,
              <br />
              by the hour.
            </h1>
            <p className="lead mt-6 max-w-md">
              A proper DJ booth — twin CDJ-3000s, a club mixer, monitoring that
              doesn&apos;t flatter you. Practice a set, record a mix, or teach a
              mate. Come alone or bring the crew.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/studio/book" className="btn btn-primary">
                Book a session
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/studio/pricing" className="btn btn-secondary">
                See pricing
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-border pt-6 font-mono text-meta uppercase tracking-meta text-text-muted">
              <div className="flex flex-col gap-1">
                <Clock className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Hours</dt>
                <dd>07:00 – 24:00</dd>
              </div>
              <div className="flex flex-col gap-1">
                <Users className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Capacity</dt>
                <dd>Up to 10</dd>
              </div>
              <div className="flex flex-col gap-1">
                <MapPin className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Price from</dt>
                <dd>From $35/hr</dd>
              </div>
            </dl>
          </div>

          <div className="relative order-first h-[40vh] md:order-none md:h-[70vh]">
            <CDJStage className="absolute inset-0" />
          </div>
        </div>
      </section>

      {/* the kit */}
      <Section>
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <SectionHeading
            eyebrow="The kit"
            title="The same gear, every session."
            lead="No surprises and nothing to relearn. What's in the room is what's in the club."
          />
          <ul className="-mt-2">
            {GEAR.map((g) => (
              <li
                key={g.n}
                className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 border-t border-border py-6 first:border-t-0 md:gap-x-8"
              >
                <span className="font-mono text-meta tracking-meta text-text-dim">
                  {g.n}
                </span>
                <div>
                  <h3 className="font-display text-h3 font-semibold text-text">
                    {g.name}
                  </h3>
                  <p className="lead mt-2 max-w-md text-pretty">{g.spec}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* pricing snippet */}
      <Section className="border-t border-border">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Pricing"
            title="Off-peak or peak. That's the whole story."
            lead="Off-peak is weekdays before 4pm. Peak is evenings and weekends. The price you see covers the whole room."
          />
          <Link
            href="/studio/pricing"
            className="link inline-flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-meta text-accent"
          >
            Full pricing
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[small, large].map((t) => (
            <div key={t.slug} className="card card-hover p-7 md:p-9">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-h3 font-semibold text-text">
                  {t.label}
                </h3>
                <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                  {t.slug === "small" ? "Solo / small crew" : "Full booth"}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border">
                <PriceCell label="Off-peak / 2h" cents={calcPriceCents(t, 2, false)} accent />
                <PriceCell label="Peak / 2h" cents={calcPriceCents(t, 2, true)} />
                <PriceCell label="Off-peak / hr" cents={calcPriceCents(t, 1, false)} />
                <PriceCell label="Peak / hr" cents={calcPriceCents(t, 1, true)} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* hire callout */}
      <Section className="border-t border-border">
        <div className="relative overflow-hidden border border-border bg-bg-elev p-8 md:p-14">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 120% at 90% 10%, rgba(61,220,151,0.10), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative grid gap-8 md:grid-cols-[1.3fr_0.7fr] md:items-center">
            <div>
              <p className="eyebrow">Hire</p>
              <h2 className="h2 mt-4 text-text">Need the gear at your place?</h2>
              <p className="lead mt-4 max-w-lg">
                The same CDJs, mixers, PA and lighting go out across Christchurch
                — collected or delivered. Tell us the event and we&apos;ll put
                together a quote.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href="/hire" className="btn btn-primary w-full md:w-auto">
                Browse hire
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/contact?subject=Hire"
                className="btn btn-secondary w-full md:w-auto"
              >
                Get a quote
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* quick links + final CTA */}
      <Section className="border-t border-border">
        <div className="grid gap-4 md:grid-cols-3">
          <QuickLink href="/studio/the-room" title="The room" copy="A look at the booth, the kit and the space." />
          <QuickLink href="/studio/info" title="Before you come" copy="ID, access, what to bring, house rules." />
          <QuickLink href="/studio/book" title="Book a session" copy="Pick a time, lock it in. 90 days out." accent />
        </div>
      </Section>
    </>
  );
}

function PriceCell({
  label,
  cents,
  accent,
}: {
  label: string;
  cents: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-bg-elev px-5 py-5">
      <p className="font-mono text-meta uppercase tracking-meta text-text-muted">
        {label}
      </p>
      <p className="mono mt-2 text-2xl text-text">
        <span className="text-base text-text-muted">$</span>
        <span className={accent ? "text-accent" : ""}>
          {(cents / 100).toFixed(2)}
        </span>
      </p>
    </div>
  );
}

function QuickLink({
  href,
  title,
  copy,
  accent,
}: {
  href: string;
  title: string;
  copy: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="card card-hover group flex flex-col justify-between gap-8 p-7"
    >
      <div>
        <h3 className="font-display text-h3 font-semibold text-text">{title}</h3>
        <p className="lead mt-2 text-pretty">{copy}</p>
      </div>
      <span
        className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-meta ${accent ? "text-accent" : "text-text-muted"}`}
      >
        {accent ? "Book now" : "Read more"}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden
        />
      </span>
    </Link>
  );
}
