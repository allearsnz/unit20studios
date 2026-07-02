"use client";

import {
  BOOKING_OPTIONS,
  formatNZDPlusGst,
  type BookingOptionId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Booking-option cards (1h / 2h / weekday-daytime 2h / 10-hour pack), shown
 * after the date and before the time. Presentational — availability of each
 * option for the chosen day is computed in BookingFlow.
 */
export function OptionPicker({
  value,
  onChange,
  disabledReason,
}: {
  value: BookingOptionId | null;
  onChange: (id: BookingOptionId) => void;
  /** Per-option reason it can't be picked on this day (null = pickable). */
  disabledReason: (id: BookingOptionId) => string | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Booking option">
      {BOOKING_OPTIONS.map((opt) => {
        const reason = disabledReason(opt.id);
        const disabled = reason !== null;
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-sm border p-5 text-left transition-colors",
              disabled && "cursor-not-allowed border-transparent bg-bg-elev/40",
              !disabled && !selected && "border-border hover:border-accent",
              selected && "border-accent bg-accent/5",
            )}
          >
            <span className="flex w-full items-baseline justify-between gap-3">
              <span
                className={cn(
                  "font-display text-lg font-semibold",
                  disabled ? "text-text-dim/40" : "text-text",
                )}
              >
                {opt.label}
              </span>
              <span
                className={cn(
                  "mono text-sm",
                  disabled ? "text-text-dim/40" : selected ? "text-accent" : "text-text-muted",
                )}
              >
                {formatNZDPlusGst(opt.baseCents)}
              </span>
            </span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-meta",
                disabled ? "text-text-dim/40" : selected ? "text-accent" : "text-text-dim",
              )}
            >
              {reason ?? opt.note}
            </span>
          </button>
        );
      })}
    </div>
  );
}
