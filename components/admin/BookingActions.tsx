"use client";

import { useTransition } from "react";
import { cancelBooking, resendConfirmation, setBookingStatus } from "@/app/admin/actions";
import type { BookingStatus } from "@/lib/types";

const btn = "btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta";

/**
 * NO `router.refresh()` HERE, DELIBERATELY. Each of these actions calls
 * `revalidatePath` for this page, and a Server Function that revalidates the
 * route you're on returns the re-rendered page with its result — the UI is
 * already up to date by the time the promise resolves. The extra `refresh()`
 * this used to do was a second full round trip: proxy auth, layout, every query
 * on the page, again, for a result that had already arrived.
 */
export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));

  const active = status === "pending_verification" || status === "confirmed";

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending_verification" ? (
        <button
          disabled={pending}
          onClick={() => run(() => setBookingStatus(id, "confirmed"))}
          className="btn btn-primary h-10 px-4 font-mono text-xs uppercase tracking-meta"
        >
          Confirm
        </button>
      ) : null}
      {active ? (
        <button disabled={pending} onClick={() => run(() => setBookingStatus(id, "completed"))} className={btn}>
          Mark completed
        </button>
      ) : null}
      {active ? (
        <button disabled={pending} onClick={() => run(() => setBookingStatus(id, "no_show"))} className={btn}>
          No-show
        </button>
      ) : null}
      {status !== "cancelled" ? (
        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Cancel this booking and email the customer?")) run(() => cancelBooking(id));
          }}
          className="btn h-10 border border-danger/40 px-4 font-mono text-xs uppercase tracking-meta text-danger hover:border-danger"
        >
          Cancel
        </button>
      ) : null}
      <button disabled={pending} onClick={() => run(() => resendConfirmation(id))} className={btn}>
        Resend email
      </button>
    </div>
  );
}
