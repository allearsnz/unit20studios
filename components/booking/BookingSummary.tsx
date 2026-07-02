"use client";

import { cn } from "@/lib/utils";

type Row = { label: string; value: string | null };

export function BookingSummary({
  dateLabel,
  optionLabel,
  timeLabel,
  durationHours,
  tierLabel,
  groupSize,
  surchargeLabel,
  totalLabel,
  dealNote,
  packNote,
  className,
}: {
  dateLabel: string | null;
  /** The chosen booking option, e.g. "10-hour pack". */
  optionLabel: string | null;
  timeLabel: string | null;
  durationHours: number;
  tierLabel: string | null;
  groupSize: number;
  /** Group surcharge included in the total, e.g. "+$30.00+GST". */
  surchargeLabel?: string | null;
  /** Total to pay, GST-explicit — e.g. "$80.00 + GST ($92.00)". */
  totalLabel: string | null;
  /** Set when the weekday-daytime rate applies, e.g. "Weekday daytime (Mon–Fri, 10am–4pm)". */
  dealNote?: string | null;
  /** Set for 10-hour pack bookings — explains the remaining hours. */
  packNote?: string | null;
  className?: string;
}) {
  const rows: Row[] = [
    { label: "Date", value: dateLabel },
    { label: "Option", value: optionLabel },
    { label: "Time", value: timeLabel },
    {
      label: "Duration",
      value: durationHours ? `${durationHours}h` : null,
    },
    { label: "Room", value: tierLabel },
    { label: "People", value: groupSize ? String(groupSize) : null },
    ...(surchargeLabel ? [{ label: "Group surcharge", value: surchargeLabel }] : []),
  ];

  return (
    <div className={cn("card p-6", className)}>
      <p className="eyebrow mb-5">Your session</p>
      <dl className="space-y-0">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0"
          >
            <dt className="font-mono text-meta uppercase tracking-meta text-text-muted">
              {r.label}
            </dt>
            <dd className={cn("text-right text-sm", r.value ? "text-text" : "text-text-dim")}>
              {r.value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border-strong pt-4">
        <span className="font-mono text-meta uppercase tracking-meta text-text-muted">Total</span>
        <span className="mono text-right text-lg text-accent">{totalLabel ?? "—"}</span>
      </div>
      {dealNote ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-meta text-accent">
          {dealNote} rate
        </p>
      ) : null}
      {packNote ? <p className="mt-3 text-xs text-text-muted">{packNote}</p> : null}
      <p className="mt-3 text-xs text-text-dim">Pay in person at the start of your session.</p>
    </div>
  );
}
