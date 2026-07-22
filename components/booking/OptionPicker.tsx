"use client";

import {
  formatNZDPlusGst,
  type BookingOption,
  type BookingOptionId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * Booking-option cards, shown after the date and before the time. The list is
 * built in BookingFlow (standard options always; banked-hours options only for
 * a signed-in account with enough balance). Presentational — per-option
 * availability for the chosen day is computed by the parent.
 */
export function OptionPicker({
  options,
  value,
  onChange,
  disabledReason,
}: {
  options: BookingOption[];
  value: BookingOptionId | null;
  onChange: (id: BookingOptionId) => void;
  /** Per-option reason it can't be picked on this day (null = pickable). */
  disabledReason: (id: BookingOptionId) => string | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Booking option">
      {options.map((opt) => {
        const reason = disabledReason(opt.id);
        const disabled = reason !== null;
        const selected = value === opt.id;
        const priceLabel = opt.usesBankedHours
          ? `${opt.durationHours} banked`
          : formatNZDPlusGst(opt.baseCents);
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
                  "mono whitespace-nowrap text-sm",
                  disabled ? "text-text-dim/40" : selected ? "text-accent" : "text-text-muted",
                )}
              >
                {priceLabel}
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
