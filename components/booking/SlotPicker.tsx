"use client";

import { formatNZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Slot } from "./types";

/** Hourly slot grid. Presentational — selection logic lives in BookingFlow. */
export function SlotPicker({
  slots,
  loading,
  isSelected,
  onToggle,
}: {
  slots: Slot[];
  loading: boolean;
  isSelected: (index: number) => boolean;
  onToggle: (index: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm border border-border bg-bg-elev" />
        ))}
      </div>
    );
  }

  const anyAvailable = slots.some((s) => s.available);
  if (!anyAvailable) {
    return (
      <p className="lead">
        Nothing free on this day. Try another date — or{" "}
        <a href="/contact?subject=Studio" className="link text-accent">
          get in touch
        </a>{" "}
        and we&apos;ll find you a slot.
      </p>
    );
  }

  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      role="group"
      aria-label="Available hours"
    >
      {slots.map((slot, i) => {
        const selected = isSelected(i);
        return (
          <button
            key={slot.start}
            type="button"
            disabled={!slot.available}
            aria-pressed={selected}
            onClick={() => onToggle(i)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-sm border px-3 py-2.5 text-left transition-colors",
              !slot.available && "cursor-not-allowed border-transparent bg-bg-elev/40 text-text-dim/40 line-through",
              slot.available && !selected && "border-border text-text hover:border-accent",
              selected && "border-accent bg-accent text-bg",
            )}
          >
            <span className="mono text-sm">{formatNZ(slot.start, "HH:mm")}</span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-meta",
                selected ? "text-bg/70" : "text-text-dim",
              )}
            >
              {!slot.available ? "—" : slot.is_peak ? "Peak" : "Off-peak"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
