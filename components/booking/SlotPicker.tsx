"use client";

import { formatNZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Slot } from "./types";

/**
 * Start-time grid, filtered to the chosen booking option: 1-hour options show
 * every free hour; 2-hour options (incl. the pack's first session) need the
 * next hour free too; the weekday-daytime option additionally needs a
 * qualifying start (Mon–Fri, session inside 10am–4pm). Presentational —
 * eligibility rules live here, selection state in BookingFlow.
 */
export function SlotPicker({
  slots,
  loading,
  durationHours,
  requireDaytime,
  selectedIdx,
  onSelect,
}: {
  slots: Slot[];
  loading: boolean;
  /** Session length for the chosen option (1 or 2). */
  durationHours: number;
  /** Only weekday-daytime (deal_2h) starts are selectable. */
  requireDaytime: boolean;
  selectedIdx: number | null;
  onSelect: (index: number | null) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm border border-border bg-bg-elev" />
        ))}
      </div>
    );
  }

  const canStart = (i: number) => {
    const slot = slots[i];
    if (!slot?.available) return false;
    for (let k = 1; k < durationHours; k++) {
      if (!slots[i + k]?.available) return false;
    }
    if (requireDaytime && !slot.deal_2h) return false;
    return true;
  };

  const anyStart = slots.some((_, i) => canStart(i));
  if (!anyStart) {
    return (
      <p className="lead">
        No {requireDaytime ? "weekday-daytime " : ""}
        {durationHours}-hour starts left on this day. Try another date or
        option — or{" "}
        <a href="/contact?subject=Studio" className="link text-accent">
          get in touch
        </a>{" "}
        and we&apos;ll find you a slot.
      </p>
    );
  }

  const inSelection = (i: number) =>
    selectedIdx !== null && i >= selectedIdx && i < selectedIdx + durationHours;

  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      role="group"
      aria-label="Available start times"
    >
      {slots.map((slot, i) => {
        const eligible = canStart(i);
        const selected = inSelection(i);
        const sessionEnd = eligible ? slots[i + durationHours - 1]?.end : null;
        return (
          <button
            key={slot.start}
            type="button"
            disabled={!eligible}
            aria-pressed={selected}
            onClick={() => onSelect(selectedIdx === i ? null : i)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-sm border px-3 py-2.5 text-left transition-colors",
              !eligible && !selected && "cursor-not-allowed border-transparent bg-bg-elev/40 text-text-dim/40 line-through",
              eligible && !selected && "border-border text-text hover:border-accent",
              selected && "border-accent bg-accent text-bg",
            )}
          >
            <span className="mono text-sm">{formatNZ(slot.start, "HH:mm")}</span>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-meta",
                selected ? "text-bg/70" : eligible ? "text-text-dim" : "text-text-dim/40",
              )}
            >
              {selected
                ? "Selected"
                : eligible && sessionEnd
                  ? `til ${formatNZ(sessionEnd, "HH:mm")}`
                  : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
