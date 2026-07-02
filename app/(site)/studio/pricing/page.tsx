import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Mail } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { BULK_PACK, FLAT_TIER, WEEKDAY_DAYTIME_DEAL, formatNZDPlusGst } from "@/lib/pricing";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Studio pricing — $50+GST/hr, $80+GST/2hr",
  description:
    "Unit 20 studio pricing. $50+GST per hour, $80+GST for two hours — or $60+GST for two hours weekday daytime (Mon–Fri, 10am–4pm). Bulk 10-hour pack at $25+GST/hr.",
  alternates: { canonical: "/studio/pricing" },
};

const INCLUDED = [
  "The whole room, your group",
  "4× CDJ-3000 + DJM-A9 mixer",
  "QSC K12.2 + JBL EON618S monitoring",
  "Custom lighting and temperature control",
];

const FAQS = [
  {
    q: "When does the $60 two-hour rate apply?",
    a: "Any 2-hour session on a weekday (Mon–Fri) that sits inside 10am–4pm — so a start between 10am and 2pm — is $60+GST instead of the standard $80+GST. Evenings and weekends are the standard rate.",
  },
  {
    q: "Is there a deposit?",
    a: "No deposit for standard 1 or 2-hour sessions — pay in person at the start by card or cash. The 10-hour pack is prepaid — book your first session online and we'll sort payment with you.",
  },
  {
    q: "What if I want more than 2 hours?",
    a: "Get in touch — sessions over 2 hours and recurring weekly slots are quoted directly. Email studio@unit20.nz with your dates.",
  },
  {
    q: "What about groups bigger than 4?",
    a: "The room takes up to 8. Groups of 5–8 add a flat surcharge — $20+GST on a 1-hour session, $30+GST on a 2-hour session — added automatically when you book.",
  },
  {
    q: "How does the cancellation policy work?",
    a: "Give us 24 hours' notice to move or cancel free of charge. Inside 24 hours we may charge for the booked time.",
  },
  {
    q: "Can we go over our booked time?",
    a: "If the room's free after your slot, you're welcome to run on and we'll square up the extra on the night. We hold a 15-minute buffer between sessions either way.",
  },
];

const BULK_CONTACT_MAILTO = `mailto:${site.email}?subject=${encodeURIComponent(
  "10-hour bulk pack",
)}&body=${encodeURIComponent(
  "Hi Unit 20,\n\nI'd like to set up the 10-hour bulk pack ($25+GST/hr).\n\nAny start dates / weekly pattern in mind:\n\nThanks",
)}`;

const LONGER_CONTACT_MAILTO = `mailto:${site.email}?subject=${encodeURIComponent(
  "Longer session enquiry",
)}&body=${encodeURIComponent(
  "Hi Unit 20,\n\nI'd like to book a longer session.\n\nDate(s):\nDuration:\nGroup size:\n\nThanks",
)}`;

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: "DJ practice studio hire",
            serviceType: "DJ practice studio",
            path: "/studio/pricing",
            offers: [
              {
                name: "1 hour",
                price: (FLAT_TIER.peak_1h_price_cents / 100).toFixed(2),
                url: "/studio/book",
              },
              {
                name: "2 hours",
                price: (FLAT_TIER.peak_2h_price_cents / 100).toFixed(2),
                url: "/studio/book",
              },
              {
                name: `2 hours — ${WEEKDAY_DAYTIME_DEAL.label}`,
                price: (WEEKDAY_DAYTIME_DEAL.twoHourPriceCents / 100).toFixed(2),
                url: "/studio/book",
              },
              {
                name: "10-hour bulk pack",
                price: (BULK_PACK.totalCents / 100).toFixed(2),
                url: "/studio/book",
              },
            ],
          }),
          faqPageLd(FAQS),
          breadcrumbLd([
            { name: "Studio", path: "/studio" },
            { name: "Pricing", path: "/studio/pricing" },
          ]),
        ]}
      />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="Studio · Pricing"
          title="Pay as you go, no contracts."
          lead="One price for the room. Book by the hour and pay on arrival, or buy a bulk pack and save. Weekday daytime (Mon–Fri, 10am–4pm): 2 hours for $60+GST."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {/* Card 1: flat rate */}
          <div className="card p-7 md:p-9">
            <div className="flex items-baseline justify-between border-b border-border pb-5">
              <h2 className="font-display text-h2 font-semibold text-text">
                Pay as you go
              </h2>
              <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                Up to 8 people
              </span>
            </div>

            <ul className="mt-6 space-y-5">
              <PriceRow
                label="1 hour"
                value={formatNZDPlusGst(FLAT_TIER.peak_1h_price_cents)}
              />
              <PriceRow
                label="2 hours"
                value={formatNZDPlusGst(FLAT_TIER.peak_2h_price_cents)}
              />
              <PriceRow
                label="2 hours · weekday daytime"
                value={formatNZDPlusGst(WEEKDAY_DAYTIME_DEAL.twoHourPriceCents)}
                accent
              />
            </ul>

            <p className="mt-6 border-t border-border pt-4 font-mono text-meta uppercase tracking-meta text-text-muted">
              Weekday daytime = Mon–Fri, sessions inside 10am–4pm. All prices
              +GST. Groups of 5–8 add $20+GST (1h) / $30+GST (2h), added
              automatically when you book.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/studio/book"
                className="btn btn-primary inline-flex flex-1 items-center justify-center gap-2"
              >
                Book a session
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href={LONGER_CONTACT_MAILTO}
                className="btn btn-secondary inline-flex flex-1 items-center justify-center gap-2"
              >
                3+ hours? Enquire
              </a>
            </div>
          </div>

          {/* Card 2: bulk pack */}
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
              <div className="flex items-baseline justify-between border-b border-border pb-5">
                <h2 className="font-display text-h2 font-semibold text-text">
                  10-hour bulk pack
                </h2>
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
              <p className="lead mt-3 text-pretty">
                Prepay 10 hours (${(BULK_PACK.totalCents / 100).toFixed(0)}+GST
                total) and use them whenever — half the standard rate. Perfect
                if you&apos;re practising weekly. Book online: pick your first
                2-hour session and we&apos;ll sort the rest of your hours with
                you.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/studio/book"
                  className="btn btn-primary inline-flex items-center gap-2"
                >
                  Book the 10-hour pack
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href={BULK_CONTACT_MAILTO}
                  className="btn btn-secondary inline-flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  Questions? Email us
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-8 border-t border-border pt-10 md:flex-row md:items-start md:justify-between">
          <ul className="grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-text-muted">
                <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <Link href="/studio/book" className="btn btn-primary shrink-0">
            Book a session
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>

      <Section className="border-t border-border">
        <SectionHeading eyebrow="Pricing · FAQ" title="The fine print, plainly." />
        <div className="mt-10">
          <Faq items={FAQS} />
        </div>
      </Section>
    </>
  );
}

function PriceRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <span className="font-mono text-meta uppercase tracking-meta text-text-muted">
        {label}
      </span>
      <span
        className={`mono text-h3 ${accent ? "text-accent" : "text-text"}`}
      >
        {value}
      </span>
    </li>
  );
}
