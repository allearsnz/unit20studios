"use client";

import { cn } from "@/lib/utils";

type Row = { label: string; value: string | null };

export function BookingSummary({
  dateLabel,
  timeLabel,
  durationHours,
  tierLabel,
  groupSize,
  totalLabel,
  className,
}: {
  dateLabel: string | null;
  timeLabel: string | null;
  durationHours: number;
  tierLabel: string | null;
  groupSize: number;
  totalLabel: string | null;
  className?: string;
}) {
  const rows: Row[] = [
    { label: "Date", value: dateLabel },
    { label: "Time", value: timeLabel },
    {
      label: "Duration",
      value: durationHours ? `${durationHours}h` : null,
    },
    { label: "Room", value: tierLabel },
    { label: "People", value: groupSize ? String(groupSize) : null },
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

      <div className="mt-4 flex items-baseline justify-between border-t border-border-strong pt-4">
        <span className="font-mono text-meta uppercase tracking-meta text-text-muted">Total</span>
        <span className="mono text-2xl text-accent">{totalLabel ?? "—"}</span>
      </div>
      <p className="mt-3 text-xs text-text-dim">Pay in person at the start of your session.</p>
    </div>
  );
}
