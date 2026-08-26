"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Mail, X } from "lucide-react";
import { setPaymentStatus, type PaymentUpdateResult } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";

const OPTIONS: PaymentStatus[] = ["unpaid", "paid", "refunded", "comped"];

/**
 * Payment status, and an honest account of what changing it does.
 *
 * MARKING A BOOKING PAID IS A SEND BUTTON. It fires two emails to the customer
 * — the door code (minted against the TTLock by the crew system) and the access
 * instructions — and nothing in this UI used to say so. The admin clicked a
 * status chip and the studio's entire access flow happened somewhere off-screen.
 *
 * So 'paid' is now a two-step: state exactly what is about to go out and to
 * whom, then report what actually came back. The other three statuses send
 * nothing and stay one tap, because a confirmation nobody needs is a
 * confirmation everybody clicks through.
 *
 * AND WHEN THE SESSION IS ALREADY OVER, PAID SENDS NOTHING EITHER. Squaring up
 * last week's session is bookkeeping: there is no door code to mint (the crew
 * trigger only enqueues one while the session is ahead) and directions to a
 * room someone has already played in are noise. That case used to be a warning
 * you had to read and accept before emailing them anyway; now it is one tap and
 * a line saying nothing went out. Same for a cancelled booking.
 */
export function PaymentControl({
  id,
  value,
  customerEmail,
  /** True when the session is already over — the crew trigger won't mint a code. */
  sessionEnded,
  cancelled,
}: {
  id: string;
  value: PaymentStatus;
  customerEmail: string | null;
  sessionEnded: boolean;
  cancelled: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<PaymentUpdateResult | null>(null);

  // Nothing is sent for a session that has been and gone, or one that was
  // cancelled — so there is nothing to confirm. This mirrors the same condition
  // the server checks (lib/booking-paid.ts `skipReason`); the server is what
  // actually decides, this only decides whether to ask first.
  const sendsNothing = cancelled || sessionEnded;

  // No `router.refresh()`: `setPaymentStatus` revalidates this page, so its
  // result arrives with the page already re-rendered. Refreshing on top of that
  // re-ran every query on the page for nothing — and this is the slowest action
  // in the admin, because it also sends two emails before it returns.
  const apply = (opt: PaymentStatus) =>
    start(async () => {
      const r = await setPaymentStatus(id, opt);
      setResult(r.triggered ? r : null);
      setConfirming(false);
    });

  return (
    <div>
      <div className="inline-flex flex-wrap gap-1 rounded-sm border border-border p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={pending}
            aria-pressed={value === opt}
            onClick={() => {
              setResult(null);
              // Only the not-paid → paid move on a session that is still ahead
              // sends anything; everything else, including re-selecting the
              // status it's already on, is silent and goes straight through.
              if (opt === "paid" && value !== "paid" && !sendsNothing) setConfirming(true);
              else apply(opt);
            }}
            className={cn(
              "rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-meta transition-colors",
              value === opt ? "bg-accent text-bg" : "text-text-muted hover:text-text",
            )}
          >
            {opt}
          </button>
        ))}
      </div>

      {confirming ? (
        <div className="mt-4 border border-accent/40 bg-bg-elev p-4">
          <p className="font-mono text-[11px] uppercase tracking-meta text-accent">
            Marking paid will email the customer
          </p>
          <ul className="mt-3 space-y-2 text-sm text-text">
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <span>
                <strong className="font-semibold">Their door code.</strong>{" "}
                <span className="text-text-muted">
                  Minted against the studio lock for the booked window only, then
                  emailed by the crew system. Usually within a minute.
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <span>
                <strong className="font-semibold">Access instructions.</strong>{" "}
                <span className="text-text-muted">
                  Where to go, what to bring, and that the code is coming separately.
                </span>
              </span>
            </li>
          </ul>

          <p className="mt-3 border-t border-border pt-3 text-sm">
            {customerEmail ? (
              <>
                <span className="text-text-muted">Both go to </span>
                <span className="mono text-text">{customerEmail}</span>
              </>
            ) : (
              <span className="inline-flex items-start gap-2 text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                This customer has no email address on file — nothing can be sent.
                The booking will still be marked paid.
              </span>
            )}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => apply("paid")}
              className="btn btn-primary h-10 px-4 font-mono text-xs uppercase tracking-meta"
            >
              {pending ? "Sending…" : "Mark paid & send"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {result ? <Outcome result={result} /> : null}

      {sendsNothing && value !== "paid" ? (
        <p className="mt-4 text-xs text-text-dim">
          {cancelled
            ? "This booking is cancelled, so marking it paid emails nothing — it just records the money."
            : "This session has already finished, so marking it paid emails nothing — no door code, no access instructions. It just records the money."}
        </p>
      ) : (
        <p className="mt-4 text-xs text-text-dim">
          Every step that follows a payment — code minted, code emailed, access
          email sent — is listed under{" "}
          <strong className="text-text-muted">Automation</strong>, with timestamps.
        </p>
      )}
    </div>
  );
}

/**
 * What came back. Reported per-email rather than as one "done", because the two
 * sends fail independently and "the code went but the instructions didn't" is a
 * real, and different, problem.
 */
function Outcome({ result }: { result: PaymentUpdateResult }) {
  // Nothing was attempted, so there is nothing to report per-email. Say that
  // plainly rather than render two rows about sends that never happened.
  if (result.skipped) {
    return (
      <div aria-live="polite" className="mt-4 border border-border bg-bg-elev p-4">
        <Line
          ok
          text={
            result.skipped === "cancelled"
              ? "Marked paid. Nothing was emailed — the booking is cancelled."
              : "Marked paid. Nothing was emailed — the session has already finished."
          }
        />
      </div>
    );
  }

  const accessOk = result.access === "sent" || result.access === "already_sent";
  const accessLine =
    result.access === "sent"
      ? "Access instructions sent."
      : result.access === "already_sent"
        ? "Access instructions had already been sent — not sent twice."
        : result.access === "no_email"
          ? "No access email: this customer has no email address on file."
          : result.access === "not_found"
            ? "No access email: the booking couldn't be re-read. Check the Automation list."
            : `Access instructions FAILED${result.accessError ? ` — ${result.accessError}` : ""}.`;

  return (
    <div aria-live="polite" className="mt-4 space-y-2 border border-border bg-bg-elev p-4">
      <Line ok={accessOk} text={accessLine} />
      <Line
        ok={result.doorCodeQueued === true}
        text={
          result.doorCodeQueued
            ? "Door-code minting kicked off. It's minted and emailed by the crew system — check the Automation tab for the result."
            : "Couldn't reach the door-code minter. The crew cron retries every minute; the Automation tab shows whether it landed."
        }
      />
    </div>
  );
}

function Line({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={cn("flex gap-2 text-sm", ok ? "text-text" : "text-amber-400")}>
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      {text}
    </p>
  );
}
