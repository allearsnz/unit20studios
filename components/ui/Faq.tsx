"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

export type FaqItem = { q: string; a: string };

/** Branded FAQ accordion. Pair with faqPageLd() for the structured data. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="border-t border-border">
      {items.map((it, i) => (
        <Accordion.Item
          key={i}
          value={`item-${i}`}
          className="border-b border-border"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-6 py-5 text-left">
              <span className="font-display text-h3 font-semibold text-text">
                {it.q}
              </span>
              <Plus
                className="h-5 w-5 shrink-0 text-accent transition-transform duration-300 group-data-[state=open]:rotate-45"
                aria-hidden
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="acc-content overflow-hidden">
            <p className="lead max-w-2xl pb-6 text-pretty">{it.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
