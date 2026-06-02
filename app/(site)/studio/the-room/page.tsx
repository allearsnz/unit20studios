import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { Section, SectionHeading } from "@/components/ui/Section";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "The room — inside the Unit 20 booth",
  description:
    "Inside the Unit 20 studio: four CDJ-3000s, a DJM-A9, QSC monitoring and treated walls in a low-lit central Christchurch booth built to feel like the club.",
  alternates: { canonical: "/studio/the-room" },
};

const SPECS = [
  { k: "Players", v: "4× Pioneer CDJ-3000" },
  { k: "Mixer", v: "Pioneer DJM-A9" },
  { k: "Monitoring", v: "QSC K12.2 + JBL EON618S sub" },
  { k: "Capacity", v: "Up to 10 people" },
  { k: "Connectivity", v: "USB · rec out · aux in" },
  { k: "Hours", v: "07:00 – 24:00, 7 days" },
];

// NOTE: gradient blocks are photography placeholders — swap for next/image
// Unsplash (or real shoot) at the photography step.
const SHOTS = [
  {
    label: "The booth",
    gradient:
      "radial-gradient(120% 100% at 30% 20%, rgba(61,220,151,0.16), transparent 60%), linear-gradient(160deg,#161616,#0c0c0c)",
  },
  {
    label: "Monitoring",
    gradient:
      "radial-gradient(100% 100% at 80% 80%, rgba(245,241,234,0.08), transparent 55%), linear-gradient(160deg,#181818,#0d0d0d)",
  },
  {
    label: "The couch",
    gradient:
      "radial-gradient(110% 110% at 60% 30%, rgba(229,72,77,0.12), transparent 60%), linear-gradient(160deg,#15100f,#0b0b0b)",
  },
];

export default function TheRoomPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Studio", path: "/studio" },
          { name: "The room", path: "/studio/the-room" },
        ])}
      />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="Studio · The room"
          title="Built to feel like the club."
          lead="One purpose-built booth in the central city. Low light, treated walls, real flagship gear set up exactly as you'd meet it on a Friday. Practice should feel like the gig — so it does."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {SHOTS.map((s) => (
            <figure
              key={s.label}
              className="relative aspect-[4/5] overflow-hidden border border-border"
              style={{ background: s.gradient }}
            >
              <figcaption className="absolute bottom-4 left-4 font-mono text-meta uppercase tracking-meta text-text-muted">
                {s.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <SectionHeading
            eyebrow="Specs"
            title="What you're working with."
            lead="Flagship Pioneer throughout — the exact setup that runs real rooms."
          />
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            {SPECS.map((s) => (
              <div
                key={s.k}
                className="flex items-baseline justify-between gap-6 border-t border-border py-5 sm:[&:nth-child(2)]:border-t sm:[&:nth-child(-n+2)]:border-t"
              >
                <dt className="font-mono text-meta uppercase tracking-meta text-text-muted">
                  {s.k}
                </dt>
                <dd className="text-right font-display text-h3 font-semibold text-text">
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <SectionHeading
            title="Want to see it in person?"
            lead="Book an off-peak hour for the quietest run, or get in touch for a look around."
          />
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/studio/book" className="btn btn-primary">
              Book a session
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/studio/info" className="btn btn-secondary">
              Before you come
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
