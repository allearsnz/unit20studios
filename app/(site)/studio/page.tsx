import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Banknote, Clock, MapPin, Users } from "lucide-react";
import { ParallaxPhoto } from "@/components/studio/ParallaxPhoto";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { BULK_PACK, FLAT_TIER, WEEKDAY_DAYTIME_DEAL, formatNZDPlusGst } from "@/lib/pricing";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "The Studio — practice on real club gear",
  description:
    "A DJ practice studio in central Christchurch: four Pioneer CDJ-3000s, a DJM-A9 mixer and QSC monitoring. Book by the hour, 7am–midnight. $50+GST an hour, $80+GST for two — weekday daytime (Mon–Fri, 10am–4pm) two-hour sessions just $60+GST.",
  alternates: { canonical: "/studio" },
  openGraph: { title: "Unit 20 — The Studio", url: "/studio" },
};

const GEAR = [
  {
    n: "01",
    name: "4× Pioneer CDJ-3000",
    spec: "Flagship players, all linked.",
  },
  {
    n: "02",
    name: "Pioneer DJM-A9",
    spec: "Industry-standard 4-channel club mixer.",
  },
  {
    n: "03",
    name: "QSC K12.2 + JBL EON618S",
    spec: "2000W tops and an 18-inch sub. Loud and honest.",
  },
  {
    n: "04",
    name: "The room",
    spec: "30 sqm, low light, treated walls, custom lighting and temperature control.",
  },
];

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
  offers: [
    {
      "@type": "Offer",
      name: "1 hour studio session",
      price: (FLAT_TIER.peak_1h_price_cents / 100).toFixed(2),
      priceCurrency: "NZD",
      url: `${site.url}/studio/book`,
    },
    {
      "@type": "Offer",
      name: "2 hour studio session",
      price: (FLAT_TIER.peak_2h_price_cents / 100).toFixed(2),
      priceCurrency: "NZD",
      url: `${site.url}/studio/book`,
    },
    {
      "@type": "Offer",
      name: `2 hour studio session — ${WEEKDAY_DAYTIME_DEAL.label}`,
      price: (WEEKDAY_DAYTIME_DEAL.twoHourPriceCents / 100).toFixed(2),
      priceCurrency: "NZD",
      url: `${site.url}/studio/book`,
    },
  ],
};

export default function StudioPage() {
  return (
    <>
      <JsonLd data={serviceLd} />

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="container-page grid items-center gap-10 pb-16 pt-32 md:min-h-[88vh] md:grid-cols-[1.05fr_0.95fr] md:gap-6 md:pb-24 md:pt-36">
          <div className="max-w-xl">
            <p className="eyebrow">DJ studio hire — Christchurch</p>
            <h1 className="display mt-5">
              Real club gear,
              <br />
              by the hour.
            </h1>
            <p className="lead mt-6 max-w-md">
              Prep a gig, record a mix or learn the gear. Four CDJ-3000s, a
              club mixer and proper monitoring, ready when you are. Show up
              and play.
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

            <dl className="mt-12 grid grid-cols-2 gap-4 border-t border-border pt-6 font-mono text-meta uppercase tracking-meta text-text-muted sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Clock className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Hours</dt>
                <dd>07:00 – 24:00</dd>
              </div>
              <div className="flex flex-col gap-1">
                <Users className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Capacity</dt>
                <dd>Up to 4</dd>
              </div>
              <div className="flex flex-col gap-1">
                <Banknote className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Price from</dt>
                <dd>$50+GST/hr</dd>
              </div>
              <div className="flex flex-col gap-1">
                <MapPin className="h-4 w-4 text-accent" aria-hidden />
                <dt className="sr-only">Location</dt>
                <dd>Southwark St, Chch</dd>
              </div>
            </dl>
          </div>

          <ParallaxPhoto
            src="/cdjstudio.webp"
            alt="Pioneer DJ CDJ-3000 and DJM-A9 mixer in the Unit 20 booth"
            priority
            className="relative order-first h-[40vh] md:order-none md:h-[70vh]"
          />
        </div>
      </section>

      {/* pricing snippet */}
      <Section>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            eyebrow="Pricing"
            title="Pay as you go, no contracts."
            lead="Book by the hour, pay when you arrive. One price covers the whole room."
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
          {/* Flat rate */}
          <div className="card p-7 md:p-9">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-h3 font-semibold text-text">
                Pay as you go
              </h3>
              <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                Up to 4 people
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border">
              <PriceCell label="1 hour" value={formatNZDPlusGst(FLAT_TIER.peak_1h_price_cents)} />
              <PriceCell label="2 hours" value={formatNZDPlusGst(FLAT_TIER.peak_2h_price_cents)} />
              <PriceCell
                className="col-span-2"
                label={`2 hours · ${WEEKDAY_DAYTIME_DEAL.label}`}
                value={formatNZDPlusGst(WEEKDAY_DAYTIME_DEAL.twoHourPriceCents)}
                accent
              />
            </div>
            <p className="mt-5 font-mono text-meta uppercase tracking-meta text-text-muted">
              For bookings larger than 4 people, an additional fee may apply.
            </p>
          </div>

          {/* Bulk pack */}
          <div className="card relative overflow-hidden p-7 md:p-9">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  "radial-gradient(80% 100% at 90% 0%, rgba(61,220,151,0.08), transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-h3 font-semibold text-text">
                  10-hour bulk pack
                </h3>
                <span className="font-mono text-meta uppercase tracking-meta text-accent">
                  Best value
                </span>
              </div>
              <p className="mono mt-6 text-h2 text-text">
                {formatNZDPlusGst(BULK_PACK.hourlyCents)}
                <span className="ml-2 font-sans text-meta uppercase tracking-meta text-text-muted">
                  / hour
                </span>
              </p>
              <p className="lead mt-3 text-sm text-pretty">
                Prepay 10 hours and use them whenever — half the standard rate.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* the kit */}
      <Section className="border-t border-border">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <SectionHeading
              eyebrow="The kit"
              title="What you get."
              lead="Industry-standard Pioneer DJ throughout. Same setup every session."
            />
            <Link
              href="/studio/the-room"
              className="group relative mt-8 block aspect-[4/3] overflow-hidden border border-border bg-bg-elev"
            >
              <Image
                src="/theroom.webp"
                alt="Inside the Unit 20 booth: four Pioneer CDJ-3000s and a DJM-A9 mixer"
                fill
                sizes="(min-width: 768px) 35vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/80 to-transparent" aria-hidden />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 font-mono text-meta uppercase tracking-meta text-text">
                See the room
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </Link>
          </div>
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
                We hire the same Pioneer DJ gear, PA and lighting across
                Christchurch. Tell us the event and we&apos;ll sort it.
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
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-bg-elev px-5 py-5 ${className ?? ""}`}>
      <p className="font-mono text-meta uppercase tracking-meta text-text-muted">
        {label}
      </p>
      <p className={`mono mt-2 text-xl ${accent ? "text-accent" : "text-text"}`}>
        {value}
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
