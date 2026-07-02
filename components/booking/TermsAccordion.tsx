"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { STUDIO_TERMS } from "@/lib/legal";

export function TermsAccordion({
  agree,
  marketing,
  onAgree,
  onMarketing,
  error,
}: {
  agree: boolean;
  marketing: boolean;
  onAgree: (v: boolean) => void;
  onMarketing: (v: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <Accordion.Root type="single" collapsible className="border-t border-border">
        {STUDIO_TERMS.map((t, i) => (
          <Accordion.Item key={t.title} value={`term-${i}`} className="border-b border-border">
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left">
                <span className="font-display text-lg font-semibold text-text">{t.title}</span>
                <Plus
                  className="h-4 w-4 shrink-0 text-accent transition-transform duration-300 group-data-[state=open]:rotate-45"
                  aria-hidden
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="acc-content overflow-hidden">
              <p className="lead pb-5 text-sm">{t.body}</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => onAgree(e.target.checked)}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
        />
        <span className="text-sm text-text">
          I&apos;ve read and agree to the studio terms, and I&apos;m 16 or over.
        </span>
      </label>
      {error ? (
        <p role="alert" className="mt-2 pl-8 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => onMarketing(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-accent"
        />
        <span className="text-sm text-text-muted">
          Send me the occasional Unit 20 update — new gear, weekday deals,
          events. No spam, leave anytime.
        </span>
      </label>
    </div>
  );
}
