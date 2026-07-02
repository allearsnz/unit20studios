import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Unit 20 collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What we collect",
    body: [
      "When you book the studio: your name, email, phone, date of birth (to confirm you're 16+), and any note you add. We record your booking details and whether your ID has been verified.",
      "When you contact us: your name, email, optional phone, and your message.",
      "When you browse: anonymous, aggregate usage data via privacy-friendly analytics, and standard advertising/measurement signals if you've consented to them.",
    ],
  },
  {
    title: "Why we collect it",
    body: [
      "To take and manage your booking, verify age and ID as required, send confirmations and reminders, respond to enquiries, and — only if you opt in — send occasional updates. We use aggregate analytics to understand and improve the site.",
    ],
  },
  {
    title: "Who processes it",
    body: [
      "We use trusted providers to run the service: Supabase (database hosting), Resend (transactional email), Plausible (privacy-friendly analytics), and Google Tag Manager / Meta Pixel for advertising measurement. These providers process data on our behalf under their own terms.",
    ],
  },
  {
    title: "Cookies & tracking",
    body: [
      "Essential cookies keep the site and admin working. Analytics and advertising tools may set cookies or use similar identifiers for measurement. You can block these in your browser; the core site will still work.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "We keep booking and customer records for as long as needed to run the business and meet our legal obligations. Unconfirmed bookings that are never verified are cleared automatically after 72 hours. Contact messages are kept while relevant, then removed.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Under the Privacy Act 2020 you can ask to see the personal information we hold about you, request a correction, or ask us to delete it. You can opt out of marketing at any time. Email us and we'll sort it.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="container-page pb-24 pt-32 md:pt-40">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="h1 text-text">Privacy</h1>
        <p className="lead mt-5">
          We keep this short and honest. Here&apos;s what we collect, why, and
          what you can do about it.
        </p>

        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="font-display text-lg font-semibold text-text">{s.title}</h2>
              <div className="mt-2 space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="lead text-pretty">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-border pt-6 font-mono text-meta uppercase tracking-meta text-text-dim">
          Last updated May 2026 · Privacy questions?{" "}
          <a href={`mailto:${site.email}`} className="link text-text-muted">
            {site.email}
          </a>
        </p>
      </div>
    </section>
  );
}
