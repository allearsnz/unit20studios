"use client";

import { Minus, Plus } from "lucide-react";

export function GroupSize({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-6">
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
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center border border-border-strong text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border-strong"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="mono w-6 text-center text-xl text-text" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label="More people"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center border border-border-strong text-text transition-colors hover:border-accent disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border-strong"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
