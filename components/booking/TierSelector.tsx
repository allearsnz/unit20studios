"use client";

import { Check, Minus, Plus } from "lucide-react";
import { PRICING_TIERS } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function tierRange(slug: "small" | "large") {
  return slug === "large" ? { min: 6, max: 10 } : { min: 1, max: 5 };
}

export function TierSelector({
  tierSlug,
  groupSize,
  priceByTier,
  onTier,
  onGroupSize,
}: {
  tierSlug: "small" | "large";
  groupSize: number;
  priceByTier: Record<"small" | "large", string>;
  onTier: (slug: "small" | "large") => void;
  onGroupSize: (n: number) => void;
}) {
  const { min, max } = tierRange(tierSlug);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRICING_TIERS.map((t) => {
          const active = t.slug === tierSlug;
          return (
            <button
              key={t.slug}
              type="button"
              aria-pressed={active}
              onClick={() => onTier(t.slug)}
              className={cn(
                "card p-6 text-left transition-colors",
                active ? "border-accent" : "card-hover",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-h3 font-semibold text-text">
                  {t.label}
                </span>
                {active ? <Check className="h-5 w-5 text-accent" aria-hidden /> : null}
              </div>
              <p className="lead mt-1 text-sm">
                {t.slug === "small" ? "Solo or a small crew" : "The whole booth"}
              </p>
              <p className="mono mt-5 text-2xl text-text">
                <span className="text-base text-text-muted">$</span>
                {priceByTier[t.slug as "small" | "large"]}
                <span className="ml-2 font-sans text-meta text-text-muted">this session</span>
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
        <div>
          <p className="font-mono text-meta uppercase tracking-meta text-text-muted">
            How many people?
          </p>
          <p className="mt-1 text-sm text-text-dim">Everyone in the room counts.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Fewer people"
            onClick={() => onGroupSize(Math.max(min, groupSize - 1))}
            disabled={groupSize <= min}
            className="flex h-10 w-10 items-center justify-center border border-border-strong text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border-strong"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="mono w-6 text-center text-xl text-text" aria-live="polite">
            {groupSize}
          </span>
          <button
            type="button"
            aria-label="More people"
            onClick={() => onGroupSize(Math.min(max, groupSize + 1))}
            disabled={groupSize >= max}
            className="flex h-10 w-10 items-center justify-center border border-border-strong text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border-strong"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
