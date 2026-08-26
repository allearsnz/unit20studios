import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Mail } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { PhotoBand } from "@/components/ui/PhotoBand";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { formatHour, formatNZD, formatNZDPlusGst, packHourlyCents } from "@/lib/pricing";
import { getPublicPricingSettings } from "@/lib/pricing-store";
import type { PricingSettings } from "@/lib/pricing-settings";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";
import { site } from "@/lib/site";
import { MIN_NOTICE_HOURS, WARM_DAY_NOTICE_MINUTES } from "@/lib/booking-window";

/**
 * Every price on this page is read from the live settings
 * (`/admin/pricing` → `studio_settings`), including the metadata, the
 * structured-data offers and the FAQ answers. Changing a rate in the admin
 * panel rewrites this page — there is no second copy of the numbers to forget.
 */
export async function generateMetadata(): Promise<Metadata> {
  const p = await getPublicPricingSettings();
  return {
    title: `Studio pricing — ${formatNZDPlusGst(p.rates.oneHourCents)}/hr`,
    description: `Unit 20 studio pricing. ${priceSentence(p)}`,
    alternates: { canonical: "/studio/pricing" },
  };
}

/** One sentence covering whatever rates are switched on right now. */
function priceSentence(p: PricingSettings): string {
  const parts = [
    `${formatNZDPlusGst(p.rates.oneHourCents)} per hour`,
    `${formatNZDPlusGst(p.rates.twoHourCents)} for two hours`,
  ];
  if (p.weekdayDeal.enabled) {
    parts.push(
      `or ${formatNZDPlusGst(p.weekdayDeal.twoHourPriceCents)} for two hours weekday daytime (Mon–Fri, ${dealWindow(p)}${p.weekdayDeal.shortNote ? `, ${p.weekdayDeal.shortNote.replace(/^\(|\)$/g, "")}` : ""})`,
    );
  }
  const sentence = `${parts.join(", ")}.`;
  return p.pack.enabled
    ? `${sentence} Bulk ${p.pack.packHours}-hour pack at ${formatNZDPlusGst(packHourlyCents(p))}/hr.`
    : sentence;
}

function dealWindow(p: PricingSettings): string {
  return `${formatHour(p.weekdayDeal.windowStartHour)}–${formatHour(p.weekdayDeal.windowEndHour)}`;
}

const INCLUDED = [
  "The whole room, your group",
  "4× CDJ-3000 + DJM-A9 mixer",
  "QSC K12.2 + JBL EON618S monitoring",
  "Custom lighting and temperature control",
];

/**
 * The FAQ answers quote prices, so they're built from the settings too. Only
 * the questions that still have an answer are shown — switch the deal off and
 * the question about it stops being asked.
 */
function faqs(p: PricingSettings) {
  const surchargeLine = `Groups of ${p.groupSurcharge.threshold + 1}–${p.room.maxGroupSize} add a flat surcharge — ${formatNZD(p.groupSurcharge.oneHourCents)}+GST on a 1-hour session, ${formatNZD(p.groupSurcharge.twoHourCents)}+GST on a 2-hour session — added automatically when you book.`;
  return [
    ...(p.weekdayDeal.enabled
      ? [
          {
            q: `When does the ${formatNZD(p.weekdayDeal.twoHourPriceCents)} two-hour rate apply?`,
            a: `Any 2-hour session on a weekday (Mon–Fri) that sits inside ${dealWindow(p)} — so a start between ${formatHour(p.weekdayDeal.windowStartHour)} and ${formatHour(p.weekdayDeal.windowEndHour - 2)} — is ${formatNZDPlusGst(p.weekdayDeal.twoHourPriceCents)} instead of the standard ${formatNZDPlusGst(p.rates.twoHourCents)}. Evenings and weekends are the standard rate.`,
          },
        ]
      : []),
    {
      q: "Is there a deposit?",
      a: `No deposit for standard 1 or 2-hour sessions — pay in person at the start by card or cash.${
        p.pack.enabled
          ? ` The ${p.pack.packHours}-hour pack is prepaid — book your first session online and we'll sort payment with you.`
          : ""
      }`,
    },
    {
      q: "What if I want more than 2 hours?",
      a: `Get in touch — sessions over 2 hours and recurring weekly slots are quoted directly. Email ${site.email} with your dates.`,
    },
    {
      q: `What about groups bigger than ${p.groupSurcharge.threshold}?`,
      a: `The room takes up to ${p.room.maxGroupSize}. ${surchargeLine}`,
    },
    {
      q: "How late can I book?",
      a: `On a quiet day, online booking closes ${MIN_NOTICE_HOURS} hours before a session starts — that's the time we need to open up and check the gear over before you walk in. If the studio is already open that day for an earlier session, that work is done, so anything from that session onwards is bookable right up to ${WARM_DAY_NOTICE_MINUTES} minutes before. Either way, if you're stuck, email ${site.email} and we'll tell you straight away whether we can do it.`,
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
}

const LONGER_CONTACT_MAILTO = `mailto:${site.email}?subject=${encodeURIComponent(
  "Longer session enquiry",
)}&body=${encodeURIComponent(
  "Hi Unit 20,\n\nI'd like to book a longer session.\n\nDate(s):\nDuration:\nGroup size:\n\nThanks",
)}`;

export default async function PricingPage() {
  const p = await getPublicPricingSettings();
  const FAQS = faqs(p);
  const packHourly = packHourlyCents(p);
  const bulkMailto = `mailto:${site.email}?subject=${encodeURIComponent(
    `${p.pack.packHours}-hour bulk pack`,
  )}&body=${encodeURIComponent(
    `Hi Unit 20,\n\nI'd like to set up the ${p.pack.packHours}-hour bulk pack (${formatNZD(packHourly)}+GST/hr).\n\nAny start dates / weekly pattern in mind:\n\nThanks`,
  )}`;

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
                price: (p.rates.oneHourCents / 100).toFixed(2),
                url: "/studio/book",
              },
              {
                name: "2 hours",
                price: (p.rates.twoHourCents / 100).toFixed(2),
                url: "/studio/book",
              },
              ...(p.weekdayDeal.enabled
                ? [
                    {
                      name: `2 hours — ${p.weekdayDeal.label}`,
                      price: (p.weekdayDeal.twoHourPriceCents / 100).toFixed(2),
                      url: "/studio/book",
                    },
                  ]
                : []),
              ...(p.pack.enabled
                ? [
                    {
                      name: `${p.pack.packHours}-hour bulk pack`,
                      price: (p.pack.totalCents / 100).toFixed(2),
                      url: "/studio/book",
                    },
                  ]
                : []),
            ],
          }),
          faqPageLd(FAQS),
          breadcrumbLd([
            { name: "Studio", path: "/" },
            { name: "Pricing", path: "/studio/pricing" },
          ]),
        ]}
      />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="Studio · Pricing"
          title="Pay as you go, no contracts."
          lead={`One price for the room. Book by the hour and pay on arrival${
            p.pack.enabled ? ", or buy a bulk pack and save" : ""
          }.${
            p.weekdayDeal.enabled
              ? ` Weekday daytime (Mon–Fri, ${dealWindow(p)}${p.weekdayDeal.shortNote ? `, ${p.weekdayDeal.shortNote.replace(/^\(|\)$/g, "")}` : ""}): 2 hours for ${formatNZDPlusGst(p.weekdayDeal.twoHourPriceCents)}.`
              : ""
          }`}
        />

        <div className={`mt-14 grid gap-4 ${p.pack.enabled ? "md:grid-cols-2" : ""}`}>
          {/* Card 1: flat rate */}
          <div className="card p-7 md:p-9">
            <div className="flex items-baseline justify-between border-b border-border pb-5">
              <h2 className="font-display text-h2 font-semibold text-text">
                Pay as you go
              </h2>
              <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                {p.room.label}
              </span>
            </div>

            <ul className="mt-6 space-y-5">
              <PriceRow label="1 hour" value={formatNZDPlusGst(p.rates.oneHourCents)} />
              <PriceRow label="2 hours" value={formatNZDPlusGst(p.rates.twoHourCents)} />
              {p.weekdayDeal.enabled ? (
                <PriceRow
                  label={`2 hours · weekday daytime ${p.weekdayDeal.shortNote}`}
                  value={formatNZDPlusGst(p.weekdayDeal.twoHourPriceCents)}
                  accent
                />
              ) : null}
            </ul>

            <p className="mt-6 border-t border-border pt-4 font-mono text-meta uppercase tracking-meta text-text-muted">
              {p.weekdayDeal.enabled
                ? `Weekday daytime = Mon–Fri, sessions inside ${dealWindow(p)}${p.weekdayDeal.shortNote ? `, ${p.weekdayDeal.shortNote.replace(/^\(|\)$/g, "")}` : ""}. `
                : ""}
              All prices +GST. Groups of {p.groupSurcharge.threshold + 1}–{p.room.maxGroupSize} add{" "}
              {formatNZD(p.groupSurcharge.oneHourCents)}+GST (1h) /{" "}
              {formatNZD(p.groupSurcharge.twoHourCents)}+GST (2h), added automatically when you
              book.
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
          {p.pack.enabled ? (
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
                    {p.pack.packHours}-hour bulk pack
                  </h2>
                  <span className="font-mono text-meta uppercase tracking-meta text-accent">
                    Best value
                  </span>
                </div>

                <p className="mono mt-6 text-h2 text-text">
                  {formatNZDPlusGst(packHourly)}
                  <span className="ml-2 font-sans text-meta uppercase tracking-meta text-text-muted">
                    / hour
                  </span>
                </p>
                <p className="lead mt-3 text-pretty">
                  Prepay {p.pack.packHours} hours (${(p.pack.totalCents / 100).toFixed(0)}+GST
                  total) and use them whenever. Perfect if you&apos;re practising weekly. Book
                  online: pick your first {p.pack.firstSessionHours}-hour session and we&apos;ll
                  sort the rest of your hours with you.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/studio/book?option=pack10"
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    Book the {p.pack.packHours}-hour pack
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <a
                    href={bulkMailto}
                    className="btn btn-secondary inline-flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    Questions? Email us
                  </a>
                </div>
              </div>
            </div>
          ) : null}
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

      <PhotoBand
        src="/studio.png"
        alt="Pioneer DJ mixer channel strip lit blue in the Unit 20 booth"
        eyebrow="What you're paying for"
        title="One flat rate. The whole room, the whole rig."
      />

      <Section>
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
