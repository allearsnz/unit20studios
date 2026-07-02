import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { footerNav, site } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-bg">
      <div className="container-page py-16 md:py-24">
        {/* Callout */}
        <div className="flex flex-col gap-8 border-b border-border pb-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow mb-4">Find the room</p>
            <p className="h2 text-text">
              Book a session, hire the gear,
              <br />
              or put on a night.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/studio/book"
              className="btn btn-primary font-mono text-xs uppercase tracking-meta"
            >
              Book the studio
            </Link>
            <Link
              href="/contact"
              className="btn btn-secondary font-mono text-xs uppercase tracking-meta"
            >
              Get in touch
            </Link>
          </div>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center" aria-label="Unit 20 — home">
              <Wordmark className="w-[124px]" />
            </Link>
            <p className="lead mt-4 max-w-xs text-balance">
              Real club gear, by the hour.
            </p>
            <address className="mt-6 font-mono text-meta not-italic leading-relaxed text-text-muted">
              {site.address.street}
              <br />
              {site.address.locality}, {site.address.region}
              <br />
              {site.address.countryName}
            </address>
          </div>

          {footerNav.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="eyebrow mb-4">{group.title}</h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="link inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"
                      >
                        {link.label}
                        <ArrowUpRight className="h-3 w-3" aria-hidden />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="link text-sm text-text-muted hover:text-text"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Contact + social */}
        <div className="flex flex-col gap-4 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-meta uppercase tracking-meta text-text-muted">
            <a href={`mailto:${site.email}`} className="link hover:text-text">
              {site.email}
            </a>
            {site.phone ? (
              <a href={`tel:${site.phone}`} className="link hover:text-text">
                {site.phone}
              </a>
            ) : null}
            <a
              href={site.social.instagram}
              target="_blank"
              rel="noreferrer"
              className="link inline-flex items-center gap-1 hover:text-text"
            >
              Instagram
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Legal bar */}
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-6 font-mono text-meta uppercase tracking-meta text-text-dim md:flex-row md:items-center md:justify-between">
          <span>
            © {year} {site.legalName} · Christchurch, {site.address.countryName}
          </span>
          <div className="flex gap-6">
            <Link href="/terms" className="link hover:text-text-muted">
              Terms
            </Link>
            <Link href="/privacy" className="link hover:text-text-muted">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
