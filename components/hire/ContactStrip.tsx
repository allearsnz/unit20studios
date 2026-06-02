import { Mail, Phone } from "lucide-react";
import {
  HIRE_EMAIL,
  HIRE_PHONE_DISPLAY,
  HIRE_PHONE_TEL,
  buildHireMailto,
} from "@/lib/hire-contact";

type Props = {
  eyebrow?: string;
  heading: string;
  body?: string;
  subject?: string;
};

export function ContactStrip({ eyebrow, heading, body, subject }: Props) {
  const mailto = buildHireMailto({ subject });
  return (
    <section className="border-y border-border bg-bg-elev py-16 sm:py-24">
      <div className="container-page flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          {eyebrow ? (
            <span className="eyebrow">{eyebrow}</span>
          ) : null}
          <h2 className="h2 text-text">{heading}</h2>
          {body ? (
            <p className="lead max-w-xl text-pretty">{body}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={mailto}
            className="btn btn-primary inline-flex items-center justify-center gap-2"
          >
            <Mail className="size-4" aria-hidden /> {HIRE_EMAIL}
          </a>
          <a
            href={`tel:${HIRE_PHONE_TEL}`}
            className="btn btn-secondary inline-flex items-center justify-center gap-2"
            aria-label={`Call ${HIRE_PHONE_DISPLAY}`}
          >
            <Phone className="size-4" aria-hidden /> {HIRE_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </section>
  );
}
