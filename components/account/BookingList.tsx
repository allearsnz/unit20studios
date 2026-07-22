import { formatNZ } from "@/lib/timezone";
import { formatNZDPlusGst } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Booking, BookingStatus } from "@/lib/types";

export type AccountBooking = Booking & { pricing_tier: { label: string } | null };

/** Customer-facing status wording (kept separate from the admin badges). */
const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_verification: "Awaiting ID check",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Missed",
};

const STATUS_TONE: Record<BookingStatus, string> = {
  pending_verification: "text-amber-400",
  confirmed: "text-accent",
  completed: "text-text-muted",
  cancelled: "text-text-dim",
  no_show: "text-text-dim",
};

export function BookingList({
  title,
  bookings,
  empty,
}: {
  title: string;
  bookings: AccountBooking[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="eyebrow mb-4">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="border-t border-border">
          {bookings.map((b) => (
            <li key={b.id} className="border-b border-border py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-text">{formatNZ(b.start_time, "EEE d MMM yyyy")}</p>
                <p
                  className={cn(
                    "font-mono text-meta uppercase tracking-meta",
                    STATUS_TONE[b.status],
                  )}
                >
                  {STATUS_LABEL[b.status]}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-mono text-meta uppercase tracking-meta text-text-muted">
                  {formatNZ(b.start_time, "HH:mm")}–{formatNZ(b.end_time, "HH:mm")} ·{" "}
                  {b.duration_hours}h · {b.friendly_id}
                </p>
                <p className="font-mono text-meta uppercase tracking-meta text-text-dim">
                  {b.banked_hours_used > 0
                    ? `${b.banked_hours_used}h banked`
                    : b.total_price_cents === 0
                      ? "—"
                      : formatNZDPlusGst(b.total_price_cents)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
