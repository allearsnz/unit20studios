import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Faq } from "@/components/ui/Faq";
import { BEFORE_YOU_COME, HOUSE_RULES } from "@/lib/legal";
import { breadcrumbLd, faqPageLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Before you come — studio guide",
  description:
    "Everything you need before your Unit 20 studio session: getting in, what to bring, who can come, ID and the house rules.",
  alternates: { canonical: "/studio/info" },
};

const FAQS = [
  {
    q: "Do I need to bring my own music?",
    a: "Yes — bring a USB or two with your tracks, formatted FAT32 or exFAT. The CDJs read from USB. There's no laptop rekordbox link set up by default, so USB is the way in.",
  },
  {
    q: "Do you provide headphones?",
    a: "Bring your own headphones. It's more hygienic and you'll mix better on cans you know. If you forget, ask and we'll see what we can do.",
  },
  {
    q: "Can I record my set?",
    a: "Yes. There's a record out you can capture to a USB recorder or your phone. Ask on arrival and we'll point you at it.",
  },
  {
    q: "Is the studio accessible?",
    a: "The room is at street level with roller-door access. If you have specific access needs, email studio@unit20.nz before booking and we'll make sure it works for you.",
  },
];

export default function InfoPage() {
  return (
    <>
      <JsonLd
        data={[
          faqPageLd(FAQS),
          breadcrumbLd([
            { name: "Studio", path: "/studio" },
            { name: "Before you come", path: "/studio/info" },
          ]),
        ]}
      />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="Studio · Before you come"
          title="Everything you need to know."
          lead="A two-minute read so your first session runs clean. Booked already? Here's the lot."
        />

        <div className="mt-14 grid gap-x-16 gap-y-10 md:grid-cols-2">
          {BEFORE_YOU_COME.map((item, i) => (
            <div key={item.title} className="border-t border-border pt-6">
              <span className="font-mono text-meta tracking-meta text-text-dim">
                0{i + 1}
              </span>
              <h2 className="mt-2 font-display text-h3 font-semibold text-text">
                {item.title}
              </h2>
              <p className="lead mt-3 text-pretty">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <SectionHeading eyebrow="House rules" title="Six things. Keep them and we're golden." />
          <ul className="-mt-2">
            {HOUSE_RULES.map((rule, i) => (
              <li
                key={rule}
                className="grid grid-cols-[auto_1fr] gap-x-5 border-t border-border py-5 first:border-t-0"
              >
                <span className="font-mono text-meta tracking-meta text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-lg text-text">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section className="border-t border-border">
        <SectionHeading eyebrow="FAQ" title="A few more answers." />
        <div className="mt-10">
          <Faq items={FAQS} />
        </div>
        <div className="mt-12">
          <Link href="/studio/book" className="btn btn-primary">
            Book a session
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </Section>
    </>
  );
}
