"use client";

import { useState } from "react";
import { CalendarPlus, ChevronRight } from "lucide-react";
import { BookingProgress } from "./BookingProgress";
import { bookingProgress } from "@/lib/booking-progress";
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

/**
 * A customer's sessions, each one openable into its own status flow.
 *
 * The list stays a list — a seven-step tracker under every row would bury the
 * thing this page is actually for (which sessions have I got?). Opening one
 * costs nothing: the progress is derived in the browser from data already in
 * this payload, so there's no request and nothing to wait for.
 *
 * Upcoming sessions start open, and anything waiting on the customer *stays*
 * open and can't be collapsed — "we need your ID before this is confirmed" is
 * not something to make someone go looking for.
 */
export function BookingList({
  title,
  bookings,
  empty,
  idVerified,
  now,
  /** Open every row by default — used for the upcoming list. */
  defaultOpen = false,
}: {
  title: string;
  bookings: AccountBooking[];
  empty: string;
  idVerified: boolean;
  /**
   * The server's clock, read once on the page and passed down.
   *
   * Not `Date.now()` in here. Every step state on this list is a comparison
   * against "now", so reading the clock during render means the server decides
   * a session is upcoming and the browser, milliseconds later, can decide it
   * has started — a hydration mismatch on the one thing the page is for. One
   * timestamp for the whole render also stops two rows disagreeing about what
   * time it is.
   */
  now: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(defaultOpen ? bookings.map((b) => b.id) : []),
  );

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <h2 className="eyebrow mb-4">{title}</h2>
      {bookings.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="border-t border-border">
          {bookings.map((b) => {
            const progress = bookingProgress({
              status: b.status,
              payment_status: b.payment_status,
              start_time: b.start_time,
              end_time: b.end_time,
              access_sent_at: b.access_sent_at,
              idVerified,
              banked: b.banked_hours_used > 0,
            }, now);
            const isOpen = open.has(b.id) || Boolean(progress.action);
            const upcoming = new Date(b.end_time).getTime() > now;

            return (
              <li key={b.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => toggle(b.id)}
                  aria-expanded={isOpen}
                  className="w-full py-4 text-left"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-text">{formatNZ(b.start_time, "EEE d MMM yyyy")}</p>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-meta uppercase tracking-meta",
                          STATUS_TONE[b.status],
                        )}
                      >
                        {STATUS_LABEL[b.status]}
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 text-text-dim transition-transform duration-150",
                          isOpen && "rotate-90",
                        )}
                        aria-hidden
                      />
                    </span>
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
                </button>

                {isOpen ? (
                  <div className="pb-5">
                    <BookingProgress progress={progress} />
                    {upcoming && b.status !== "cancelled" ? (
                      <a
                        href={`/api/bookings/${b.friendly_id}/ics`}
                        download
                        className="mt-5 inline-flex items-center gap-2 font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4 hover:text-text"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                        Add to calendar
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
