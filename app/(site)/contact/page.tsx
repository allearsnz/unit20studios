import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { SectionHeading } from "@/components/ui/Section";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Unit 20 — studio bookings, gear-hire quotes and venue enquiries in central Christchurch.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; gear?: string }>;
}) {
  const { subject, gear } = await searchParams;
  const defaultMessage = gear
    ? `Hi — I'd like a quote for ${gear} hire.\n\nEvent / dates:\nVenue or area:\nAnything else I should know:`
    : "";

  return (
    <section className="container-page pb-24 pt-32 md:pt-40">
      <JsonLd data={breadcrumbLd([{ name: "Contact", path: "/contact" }])} />

      <SectionHeading
        as="h1"
        eyebrow="Contact"
        title="Get in touch."
        lead="Booking the studio, hiring gear, or putting on a night — tell us what you need and we'll come back quickly. Usually within a day."
      />

      <div className="mt-14 grid gap-12 md:grid-cols-[1.4fr_0.8fr] md:gap-16">
        <ContactForm defaultSubject={subject} defaultMessage={defaultMessage} />

        <aside className="space-y-8">
          <Detail label="Email">
            <a href={`mailto:${site.email}`} className="link text-text hover:text-accent">
              {site.email}
            </a>
          </Detail>
          {site.phone ? (
            <Detail label="Phone">
              <a href={`tel:${site.phone}`} className="link text-text hover:text-accent">
                {site.phone}
              </a>
            </Detail>
          ) : null}
          <Detail label="Studio">
            <address className="not-italic leading-relaxed text-text">
              {site.address.street}
              <br />
              {site.address.locality}
              <br />
              {site.address.region}, {site.address.countryName}
            </address>
          </Detail>
          <Detail label="Hours">
            <p className="text-text">10:00 – 24:00, 7 days</p>
            <p className="mt-1 text-sm text-text-dim">By booking — buzz on arrival.</p>
          </Detail>
          <Detail label="Follow">
            <a
              href={site.social.instagram}
              target="_blank"
              rel="noreferrer"
              className="link inline-flex items-center gap-1 text-text hover:text-accent"
            >
              Instagram
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </a>
          </Detail>
        </aside>
      </div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-5">
      <p className="eyebrow mb-2">{label}</p>
      <div className="font-sans">{children}</div>
    </div>
  );
}
