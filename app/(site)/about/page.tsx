import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { PhotoBand } from "@/components/ui/PhotoBand";
import { Section, SectionHeading } from "@/components/ui/Section";
import { breadcrumbLd } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Unit 20",
  description:
    "Unit 20 is a DJ practice studio and gear-hire house in central Christchurch — real club gear, by the hour, for the people who actually use it.",
  alternates: { canonical: "/about" },
};

const PILLARS = [
  { n: "01", t: "The Studio", d: "A proper booth to practice on real club gear, by the hour — day or night.", href: "/" },
  { n: "02", t: "Hire", d: "The same gear, out the door and across town for your party, night or event.", href: "/hire" },
  { n: "03", t: "Live", d: "Tickets and line-ups for Unit 20 Live shows.", href: site.liveUrl, external: true },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "About", path: "/about" }])} />

      <Section className="pt-32 md:pt-40">
        <SectionHeading
          as="h1"
          eyebrow="About"
          title="Built by people who actually play."
          lead="Unit 20 started from a simple frustration: there was nowhere in Christchurch to practice on the gear you'd actually meet in a club. Bedroom controllers only get you so far. So we built the room we wanted — and opened the doors."
        />

        <div className="mt-10 max-w-2xl space-y-6">
          <p className="lead text-pretty">
            Today it&apos;s a practice studio you can book by the hour, and a
            hire house that sends the same flagship gear out to events across
            the city.
          </p>
          <p className="lead text-pretty">
            No corporate gloss, no per-head upsell, no gatekeeping. Real gear,
            fair prices, and a room that respects what you&apos;re trying to do —
            whether that&apos;s a first lesson or a festival rehearsal.
          </p>
        </div>
      </Section>

      <PhotoBand
        src="/studio.png"
        alt="Pioneer DJ mixer channel strip lit blue in the Unit 20 booth"
        eyebrow="The gear"
        title="The same players and mixer you'll stand behind on the night."
      />

      <Section>
        <SectionHeading eyebrow="What we do" title="Real gear, three ways." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) =>
            p.external ? (
              <a key={p.n} href={p.href} target="_blank" rel="noreferrer" className="card card-hover group flex flex-col gap-6 p-7">
                <PillarBody {...p} />
              </a>
            ) : (
              <Link key={p.n} href={p.href} className="card card-hover group flex flex-col gap-6 p-7">
                <PillarBody {...p} />
              </Link>
            ),
          )}
        </div>
      </Section>

      <Section className="border-t border-border">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <SectionHeading title="Come use the room." lead="Book a session, or get in touch about gear hire." />
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/studio/book" className="btn btn-primary">
              Book a session
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/contact" className="btn btn-secondary">
              Contact
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}

function PillarBody({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <>
      <span className="font-mono text-meta tracking-meta text-text-dim">{n}</span>
      <div>
        <h3 className="font-display text-h3 font-semibold text-text">{t}</h3>
        <p className="lead mt-2 text-pretty">{d}</p>
      </div>
    </>
  );
}
