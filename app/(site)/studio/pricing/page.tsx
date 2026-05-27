import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { PRICING_TIERS, calcPriceCents } from "@/lib/pricing";
import { breadcrumbLd, faqPageLd, serviceLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Studio pricing — from $35/hr",
  description:
    "Unit 20 studio pricing. Off-peak from $35/hr, peak from $50/hr. The price covers the whole room — up to 5, or 6 to 10 people. No per-person charge.",
  alternates: { canonical: "/studio/pricing" },
};

const INCLUDED = [
  "The whole room, just your group",
  "2× CDJ-3000 + DJM-A9 mixer",
  "Full-range monitoring",
  "No per-person charge",
];

const FAQS = [
  {
    q: "Is there a deposit?",
    a: "No deposit for standard sessions. You pay in person at the start of your session by card or cash. We'll only ask for a deposit on longer or larger group bookings, and we'll tell you up front if so.",
  },
  {
    q: "What counts as peak?",
    a: "Peak is weekday evenings (4pm onward) and all day Saturday and Sunday. Off-peak is Monday to Friday before 4pm. If a session crosses from off-peak into peak, the whole booking is charged at the peak rate.",
  },
  {
    q: "How does the cancellation policy work?",
    a: "Give us 24 hours' notice to move or cancel free of charge. Inside 24 hours we may charge for the booked time. Email studio@unit20.nz and we'll sort it.",
  },
  {
    q: "Can we go over our booked time?",
    a: "If the room's free after your slot, you're welcome to run on and we'll square up the extra on the night. We hold a 15-minute buffer between sessions either way.",
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={[
          serviceLd({
            name: "DJ practice studio hire",
            serviceType: "DJ practice studio",
            path: "/studio/pricing",
            offers: PRICING_TIERS.flatMap((t) => [
              {
                name: `${t.label} — off-peak hour`,
                price: (calcPriceCents(t, 1, false) / 100).toFixed(2),
                url: "/studio/book",
              },
              {
                name: `${t.label} — peak hour`,
                price: (calcPriceCents(t, 1, true) / 100).toFixed(2),
                url: "/studio/book",
              },
            ]),
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
          title="One price for the room. That's it."
          lead="Book by the hour. Off-peak is weekday daytime; peak is evenings and weekends. The rate covers everyone in your group — no per-head maths."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {PRICING_TIERS.map((t) => (
            <div key={t.slug} className="card p-7 md:p-9">
              <div className="flex items-baseline justify-between border-b border-border pb-5">
                <h2 className="font-display text-h2 font-semibold text-text">
                  {t.label}
                </h2>
                <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                  {t.slug === "small" ? "Solo / small" : "Full booth"}
                </span>
              </div>

              <table className="mt-5 w-full border-collapse">
                <thead>
                  <tr className="font-mono text-meta uppercase tracking-meta text-text-muted">
                    <th className="pb-3 text-left font-medium">Session</th>
                    <th className="pb-3 text-right font-medium text-accent">Off-peak</th>
                    <th className="pb-3 text-right font-medium">Peak</th>
                  </tr>
                </thead>
                <tbody className="mono text-text">
                  <PriceRow
                    label="1 hour"
                    off={calcPriceCents(t, 1, false)}
                    peak={calcPriceCents(t, 1, true)}
                  />
                  <PriceRow
                    label="2 hours"
                    off={calcPriceCents(t, 2, false)}
                    peak={calcPriceCents(t, 2, true)}
                  />
                  <PriceRow
                    label="Each extra hour"
                    off={calcPriceCents(t, 3, false) - calcPriceCents(t, 2, false)}
                    peak={t.peak_extra_hour_price_cents}
                  />
                </tbody>
              </table>
            </div>
          ))}
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

function PriceRow({ label, off, peak }: { label: string; off: number; peak: number }) {
  return (
    <tr className="border-t border-border">
      <td className="py-4 font-sans text-text-muted">{label}</td>
      <td className="py-4 text-right text-accent">
        <span className="text-sm text-text-muted">$</span>
        {(off / 100).toFixed(2)}
      </td>
      <td className="py-4 text-right">
        <span className="text-sm text-text-muted">$</span>
        {(peak / 100).toFixed(2)}
      </td>
    </tr>
  );
}
