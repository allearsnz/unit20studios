"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking, resendConfirmation, setBookingStatus } from "@/app/admin/actions";
import type { BookingStatus } from "@/lib/types";

const btn = "btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta";

export function BookingActions({ id, status }: { id: string; status: BookingStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

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
