import type { Metadata } from "next";
import { STUDIO_TERMS } from "@/lib/legal";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Unit 20 studio booking terms and website terms of use.",
  alternates: { canonical: "/terms" },
};

const SITE_TERMS: { title: string; body: string }[] = [
  {
    title: "Using this website",
    body: "This site is provided to help you book the studio, hire gear and get in touch. Information is given in good faith and may change without notice. Prices shown are indicative until confirmed in a booking or quote.",
  },
  {
    title: "Bookings are an agreement",
    body: "Submitting a booking creates an agreement to these terms and the studio terms above. New customers' bookings are held pending a quick ID check; we confirm by email.",
  },
  {
    title: "Intellectual property",
    body: "The Unit 20 name, branding and site content belong to Unit 20. Please don't reproduce them without permission.",
  },
  {
    title: "Liability",
    body: "We take care to keep the site and studio accurate and safe, but we don't accept liability for indirect loss arising from use of the site. Nothing here limits rights you have under the Consumer Guarantees Act 1993 or the Fair Trading Act 1986.",
  },
  {
    title: "Governing law",
    body: "These terms are governed by the laws of New Zealand, and the New Zealand courts have jurisdiction.",
  },
];

export default function TermsPage() {
  return (
    <section className="container-page pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="h1 text-text">Terms</h1>
        <p className="lead mt-5">
          The studio booking terms and the terms for using this website. Plain
          language, no traps.
        </p>

        <h2 className="h3 mt-14 text-text">Studio booking terms</h2>
        <div className="mt-6 space-y-8">
          {STUDIO_TERMS.map((t) => (
            <Clause key={t.title} title={t.title} body={t.body} />
          ))}
        </div>

        <h2 className="h3 mt-14 text-text">Website terms</h2>
        <div className="mt-6 space-y-8">
          {SITE_TERMS.map((t) => (
            <Clause key={t.title} title={t.title} body={t.body} />
          ))}
        </div>

        <p className="mt-14 border-t border-border pt-6 font-mono text-meta uppercase tracking-meta text-text-dim">
          Last updated May 2026 · Questions?{" "}
          <a href={`mailto:${site.email}`} className="link text-text-muted">
            {site.email}
          </a>
        </p>
      </div>
    </section>
  );
}

function Clause({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      <p className="lead mt-2 text-pretty">{body}</p>
    </div>
  );
}
