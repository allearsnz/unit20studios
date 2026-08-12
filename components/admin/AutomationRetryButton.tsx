"use client";

import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { retryAccessEmail, retryDoorCode } from "@/app/admin/actions";
import type { StepAction } from "@/lib/automation";

/**
 * The one button that unsticks a stuck step.
 *
 * Every action here re-runs an EXISTING send path rather than opening a new
 * one: `retryAccessEmail` calls the same idempotent sender the paid webhook
 * calls, and `retryDoorCode` pokes the same crew edge function. Nothing on this
 * panel can email a customer something they weren't already owed.
 *
 * "Send ID link" is a link rather than a button because that action already
 * lives in the ID section of the customer card, with the context (send count,
 * rotation warning) needed to use it properly — two ways to fire the same
 * rotating token is one too many. It's now an in-page anchor: the ID section is
 * always on screen, so there's nothing to navigate to.
 */

const COPY: Record<StepAction, { label: string; busy: string }> = {
  retry_access_email: { label: "Try sending again", busy: "Sending…" },
  retry_door_code: { label: "Poke the minter", busy: "Poking…" },
  send_id_link: { label: "Send ID link", busy: "" },
};

export function AutomationRetryButton({
  bookingId,
  action,
}: {
  bookingId: string;
  action: StepAction;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (action === "send_id_link") {
    return (
      <a
        href="#id-check"
        className="mt-2 inline-flex font-mono text-[11px] uppercase tracking-meta text-accent hover:underline"
      >
        Send it from the ID section ↑
      </a>
    );
  }

  const copy = COPY[action];

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (action === "retry_access_email") {
              const r = await retryAccessEmail(bookingId);
              setMessage(
                r.status === "sent"
                  ? "Sent."
                  : r.status === "already_sent"
                    ? "Already sent — nothing to do."
                    : r.status === "no_email"
                      ? "No email address on file. Fix the customer record first."
                      : r.status === "not_found"
                        ? "Booking not found."
                        : `Still failing${r.error ? ` — ${r.error}` : ""}.`,
              );
            } else {
              const r = await retryDoorCode(bookingId);
              setMessage(
                r.ok
                  ? "Minter poked. Give it a few seconds, then reload."
                  : "Couldn't reach the minter. The crew cron retries every minute.",
              );
            }
          })
        }
        className="btn btn-secondary h-9 px-3 font-mono text-[11px] uppercase tracking-meta"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        {pending ? copy.busy : copy.label}
      </button>
      {message ? (
        <p aria-live="polite" className="mt-1.5 text-xs text-text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
