import type { Metadata } from "next";
import Image from "next/image";
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
  { k: "Capacity", v: "Up to 4 people" },
  { k: "Connectivity", v: "USB · rec out · aux in" },
  { k: "Hours", v: "07:00 – 24:00, 7 days" },
];

// "The booth" is the real Unit 20 photo (public/theroom.webp). "Monitoring"
// and "The couch" are still Unsplash holding shots — swap those when the rest
// of the shoot lands.
const SHOTS = [
  {
    label: "The booth",
    src: "/theroom.webp",
    alt: "Unit 20 booth: four Pioneer CDJ-3000s linked to a DJM-A9 mixer on a black desk",
  },
  {
    label: "Monitoring",
    src: "https://images.unsplash.com/photo-1571266028243-d220c6a82332?auto=format&fit=crop&w=1200&q=80",
    alt: "Close-up of a Pioneer CDJ player",
  },
  {
    label: "The couch",
    src: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80",
    alt: "Moody low-lit interior with warm tones",
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
          {SHOTS.map((s, i) => (
            <figure
              key={s.label}
              className="relative aspect-[4/5] overflow-hidden border border-border bg-bg-elev"
            >
              {/* TODO: real photo — replace src with a /public asset */}
              <Image
                src={s.src}
                alt={s.alt}
                fill
                priority={i === 0}
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg/80 to-transparent" aria-hidden />
              <figcaption className="absolute bottom-4 left-4 font-mono text-meta uppercase tracking-meta text-text">
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
            lead="Book a weekday-daytime session for the quietest run — Mon–Fri 10am–4pm, 2 hours for $60+GST — or get in touch for a look around."
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
