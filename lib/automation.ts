import type { SupabaseClient } from "@supabase/supabase-js";
import { xeroInvoicingConfigured } from "./xero";
import type {
  BookingWithRelations,
  IdVerification,
  StudioDoorCode,
} from "./types";

/**
 * "Has everything that should have happened to this booking, happened?" —
 * derived from real columns and real rows, never inferred from a proxy.
 *
 * WHY THIS EXISTS. A studio booking runs through eight or nine automated steps
 * across two apps, one edge function, three crons and a smart lock, and until
 * now the admin's only view of any of it was `payment_status` and a feeling.
 * The worst case is the quiet one: marking a booking paid is what sends the
 * customer their way in, that coupling was written down nowhere in the UI, and
 * a failed send left no trace at all (see migration 0014 / crew 0124).
 *
 * THE RULE THIS FILE FOLLOWS. Every row below is backed by a stored timestamp
 * or a stored row. Where there is no such record, the row says so — `unknown`
 * is a state, and it is a far better answer than a confident guess. Two things
 * genuinely cannot be observed and are labelled that way rather than faked:
 *
 *   * Whether the customer ever typed the door code in. TTLock offline
 *     passcodes work with no network and the lock never calls back. The dry-
 *     hire side solved the equivalent problem by making the customer come to
 *     one of our own pages for the code and recording the reveal (crew 0110) —
 *     the studio emails the code instead, so there is no reveal to record.
 *   * Whether an email was *delivered*. Resend accepting a message is not
 *     delivery, and no bounce webhook is wired up. "Sent" means sent.
 *
 * Read-only, service-role, admin surface only. Nothing here widens RLS: the
 * crew-owned `studio_door_codes` table is reached with the same admin client
 * the rest of /admin already uses.
 */

export type StepState =
  /** It happened, and we have the timestamp. */
  | "done"
  /** It hasn't happened yet, and it still should. */
  | "pending"
  /** It was attempted and failed, or its moment passed without it happening. */
  | "failed"
  /** It was never going to apply to this booking. */
  | "na"
  /** It may well have happened; nothing recorded it. Never a green tick. */
  | "unknown";

/** The one-tap fix an admin can apply to a stuck step, if one exists. */
export type StepAction = "send_id_link" | "retry_access_email" | "retry_door_code";

export type AutomationStep = {
  key: string;
  label: string;
  state: StepState;
  /** When it happened (ISO), for `done` rows that have a timestamp. */
  at: string | null;
  /** One honest line: what this row is asserting, or why it isn't green. */
  detail: string;
  action?: StepAction;
};

export type AutomationView = {
  steps: AutomationStep[];
  /** The door-code row, if the crew side has one. Surfaced for the code itself. */
  doorCode: StudioDoorCode | null;
};

const HOUR = 3600 * 1000;

/**
 * Gather every automated step for one booking.
 *
 * Takes the booking already joined to its customer (the admin page has it) and
 * makes two more reads: the customer's ID-check row and the booking's door
 * code. Both are single-row lookups on indexed columns.
 */
export async function automationView(
  supabase: SupabaseClient,
  booking: BookingWithRelations,
): Promise<AutomationView> {
  const [idRes, codeRes] = await Promise.all([
    supabase
      .from("id_verifications")
      .select("*")
      .eq("customer_id", booking.customer_id)
      .maybeSingle(),
    // Newest first: a manual re-issue from the crew panel supersedes the old
    // row rather than deleting it, so "the code" is the most recent one.
    supabase
      .from("studio_door_codes")
      .select("*")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const idCheck = (idRes.data as IdVerification | null) ?? null;
  const doorCode = (codeRes.data as StudioDoorCode | null) ?? null;

  return { steps: buildSteps(booking, idCheck, doorCode), doorCode };
}

/**
 * The derivation itself, pure so the reasoning is testable by reading it.
 *
 * Exported because the rules are the interesting part of this file and belong
 * next to their inputs, not buried in a component.
 */
export function buildSteps(
  b: BookingWithRelations,
  idCheck: IdVerification | null,
  code: StudioDoorCode | null,
): AutomationStep[] {
  const now = Date.now();
  const started = new Date(b.start_time).getTime() <= now;
  const ended = new Date(b.end_time).getTime() <= now;
  const cancelled = b.status === "cancelled";
  const paid = b.payment_status === "paid" || b.payment_status === "comped";
  const customerEmail = b.customer?.email ?? null;

  /** Once a booking is cancelled nothing downstream is owed to anyone. */
  const dead = (detail: string): AutomationStep["state"] => (cancelled ? "na" : ("pending" as const)) && ("pending" as const) && (detail ? "pending" : "pending");
  void dead; // (kept out of the way — cancellation is handled per-row below)

  const steps: AutomationStep[] = [];

  // ---------------------------------------------------------------- ID check
  // Three separate steps because they fail separately: we can send a link the
  // customer ignores, or sit on an upload nobody has approved.
  if (b.customer?.id_verified && !idCheck) {
    // Verified without ever using the remote flow — a walk-in keyed through
    // Quick book, or someone verified in person before the link existed.
    steps.push({
      key: "id_link",
      label: "ID upload link emailed",
      state: "na",
      at: null,
      detail: "Verified without the upload link — no link was ever needed.",
    });
    steps.push({
      key: "id_upload",
      label: "ID uploaded by customer",
      state: "na",
      at: null,
      detail: "Nothing was uploaded; this customer was verified another way.",
    });
  } else {
    steps.push({
      key: "id_link",
      label: "ID upload link emailed",
      state: idCheck?.sent_at ? "done" : cancelled ? "na" : "pending",
      at: idCheck?.sent_at ?? null,
      detail: idCheck?.sent_at
        ? (idCheck.send_count ?? 1) > 1
          ? `Sent ${idCheck.send_count} times — the latest link is the only one that works.`
          : "One-off upload link is in their inbox."
        : cancelled
          ? "Booking cancelled before a link was needed."
          : "No link has gone out. Send one from the ID tab.",
      action: idCheck?.sent_at || cancelled ? undefined : "send_id_link",
    });

    steps.push({
      key: "id_upload",
      label: "ID uploaded by customer",
      state: idCheck?.submitted_at
        ? "done"
        : cancelled
          ? "na"
          : started && !b.customer?.id_verified
            ? "failed"
            : "pending",
      at: idCheck?.submitted_at ?? null,
      detail: idCheck?.submitted_at
        ? "Images are on the ID tab until you approve, then they're deleted."
        : cancelled
          ? "Booking cancelled."
          : started && !b.customer?.id_verified
            ? "The session has started and nothing was ever uploaded."
            : "Waiting on the customer.",
    });
  }

  steps.push({
    key: "id_approved",
    label: "ID approved",
    state: b.customer?.id_verified
      ? "done"
      : cancelled
        ? "na"
        : idCheck?.submitted_at
          ? "failed"
          : "pending",
    at: b.customer?.id_verified_at ?? null,
    detail: b.customer?.id_verified
      ? b.customer.id_verified_at
        ? "Permanent — every later booking of theirs confirms straight away."
        : "Verified before approval timestamps were recorded, so there's no date."
      : cancelled
        ? "Booking cancelled."
        : idCheck?.submitted_at
          ? "They've uploaded and it's sitting there — approve it on the ID tab."
          : "Nothing to approve yet.",
  });

  // -------------------------------------------------------------- confirmed
  const confirmed = b.status !== "pending_verification" && !cancelled;
  steps.push({
    key: "confirmed",
    label: "Booking confirmed",
    state: confirmed ? "done" : cancelled ? "na" : "pending",
    at: null,
    detail: confirmed
      ? "Confirming emails the customer their booking and raises the invoice."
      : cancelled
        ? `Cancelled — the slot is back on sale.`
        : "Still pending. Confirming is what raises the invoice.",
  });

  // ---------------------------------------------------------------- invoice
  // Deliberately honest about Xero being switched off: the alternative is a
  // permanently-amber row that trains everyone to ignore this panel.
  const xeroOn = xeroInvoicingConfigured();
  if (b.total_price_cents === 0) {
    steps.push({
      key: "invoice",
      label: "Invoice raised in Xero",
      state: "na",
      at: null,
      detail: "Nothing to invoice — this session was paid out of banked hours.",
    });
  } else if (!xeroOn) {
    steps.push({
      key: "invoice",
      label: "Invoice raised in Xero",
      state: "na",
      at: null,
      detail: "Xero isn't switched on (no XERO_* env vars) — invoices are raised by hand.",
    });
  } else {
    const invoiced = Boolean(b.xero_invoice_id) || b.invoice_status === "authorised" || b.invoice_status === "paid";
    steps.push({
      key: "invoice",
      label: "Invoice raised in Xero",
      state: invoiced
        ? "done"
        : cancelled
          ? "na"
          : b.invoice_status === "creating"
            ? "failed"
            : confirmed
              ? "failed"
              : "pending",
      at: b.invoiced_at,
      detail: invoiced
        ? "Xero emailed the customer a pay-now link."
        : cancelled
          ? "Booking cancelled before an invoice was raised."
          : b.invoice_status === "creating"
            ? "Stuck mid-create — a Xero call failed after the claim. Retry from Actions."
            : confirmed
              ? "Confirmed but never invoiced. Retry from Actions."
              : "Raised when you confirm the booking.",
    });
  }

  // ---------------------------------------------------------------- payment
  steps.push({
    key: "paid",
    label: "Payment received",
    state: paid ? "done" : cancelled ? "na" : ended ? "failed" : "pending",
    at: b.paid_at,
    detail: paid
      ? b.payment_status === "comped"
        ? "Comped. That still counts as paid and still sends their way in."
        : b.paid_at
          ? "This is the event that sends their door code and access email."
          : "Marked paid before payment timestamps were recorded, so there's no time."
      : cancelled
        ? "Booking cancelled."
        : ended
          ? "The session has been and gone and it's still unpaid."
          : "Marking this paid is what sends the two emails below.",
  });

  // -------------------------------------------------------------- door code
  // The crew-side trigger only enqueues a code when payment lands while the
  // session is still ahead of us, and never for a cancelled booking. Mirror
  // that exactly — promising a code the trigger was never going to enqueue is
  // how someone ends up at a keypad with nothing to type.
  const codeApplies = !cancelled && !ended;
  if (!codeApplies) {
    steps.push({
      key: "door_code_minted",
      label: "Door code minted (TTLock)",
      state: code?.code ? "done" : "na",
      at: code?.code ? code.updated_at : null,
      detail: code?.code
        ? "Code was minted while the session was still ahead."
        : cancelled
          ? "Cancelled bookings never get a code."
          : "The session had already finished when it was paid, so no code was issued — let them in on the day.",
    });
    steps.push({
      key: "door_code_emailed",
      label: "Door code emailed",
      state: code?.emailed_at ? "done" : "na",
      at: code?.emailed_at ?? null,
      detail: code?.emailed_at
        ? `Sent to ${code.emailed_to ?? "the customer"}.`
        : "No code exists to send.",
    });
  } else {
    const minted = code?.status === "active" && Boolean(code.code);
    steps.push({
      key: "door_code_minted",
      label: "Door code minted (TTLock)",
      state: minted
        ? "done"
        : !paid
          ? "pending"
          : code?.status === "failed"
            ? "failed"
            : code
              ? "pending"
              : "failed",
      at: minted ? (code?.updated_at ?? null) : null,
      detail: minted
        ? `Valid ${code?.attempts && code.attempts > 1 ? `(after ${code.attempts} attempts) ` : ""}for the booked window only.`
        : !paid
          ? "Queued the moment you mark this paid."
          : code?.status === "failed"
            ? `TTLock refused ${code.attempts} times: ${code.last_error ?? "no reason recorded"}.`
            : code
              ? `Queued, waiting on TTLock${code.last_error ? ` — last error: ${code.last_error}` : ""}. The crew cron retries every minute.`
              : "Paid, but no code was ever queued. The crew-side trigger didn't fire.",
      action: paid && !minted ? "retry_door_code" : undefined,
    });

    steps.push({
      key: "door_code_emailed",
      label: "Door code emailed",
      state: code?.emailed_at ? "done" : minted ? "failed" : "pending",
      at: code?.emailed_at ?? null,
      detail: code?.emailed_at
        ? `Sent to ${code.emailed_to ?? "the customer"} — separate email, from the crew system.`
        : minted
          ? "The code exists but was never emailed. Re-issuing mints a fresh code and re-sends."
          : "Goes out automatically the moment the code is minted.",
      action: minted && !code?.emailed_at ? "retry_door_code" : undefined,
    });
  }

  // -------------------------------------------------- access instructions
  // The row this whole panel was built for. `access_sent_at` is the success
  // stamp; `access_last_attempt_at` is what separates a failure from a send
  // that was never attempted — which, on a paid booking, means the paid
  // Database Webhook is not wired up.
  steps.push({
    key: "access_email",
    label: "Access instructions emailed",
    state: b.access_sent_at
      ? "done"
      : cancelled
        ? "na"
        : !paid
          ? "pending"
          : "failed",
    at: b.access_sent_at,
    detail: b.access_sent_at
      ? "Where to go, what to bring, and that the code arrives separately."
      : cancelled
        ? "Booking cancelled."
        : !paid
          ? "Sends the moment you mark this paid."
          : b.access_send_error
            ? `Failed after ${b.access_send_attempts} attempt${b.access_send_attempts === 1 ? "" : "s"}: ${b.access_send_error}`
            : b.access_last_attempt_at
              ? `Attempted ${b.access_send_attempts} time${b.access_send_attempts === 1 ? "" : "s"} and didn't send — no reason was recorded.`
              : !customerEmail
                ? "This customer has no email address on file, so nothing can be sent."
                : "Paid, but nothing has ever tried to send. Check the bookings paid Database Webhook in Supabase.",
    action: !b.access_sent_at && paid && !cancelled && customerEmail ? "retry_access_email" : undefined,
  });

  // --------------------------------------------------------------- reminder
  // The cron runs daily and only picks up CONFIRMED bookings starting in the
  // next 24h, so "never sent and the session has started" has two innocent
  // explanations as well as one bad one. Say all three rather than pick.
  steps.push({
    key: "reminder",
    label: "24h reminder emailed",
    state: b.reminder_sent_at ? "done" : cancelled ? "na" : started ? "failed" : "pending",
    at: b.reminder_sent_at,
    detail: b.reminder_sent_at
      ? "Sent once; the stamp is what stops it repeating."
      : cancelled
        ? "Booking cancelled."
        : started
          ? "The session started without one. Either it was booked inside the 24h window, it wasn't confirmed in time, or the daily cron didn't run."
          : b.status === "pending_verification"
            ? "The reminder cron only chases confirmed bookings."
            : "Goes out on the daily cron once the session is inside 24 hours.",
  });

  // ------------------------------------------------------------ verification chase
  // Only meaningful while a booking is still unverified — this is the warning
  // the cleanup cron must send before it will release a slot (crew 0120).
  if (b.status === "pending_verification" && !cancelled) {
    steps.push({
      key: "verification_chase",
      label: "ID chase before slot release",
      state: b.verification_reminder_at ? "done" : "pending",
      at: b.verification_reminder_at,
      detail: b.verification_reminder_at
        ? "Warned. The nightly job releases the slot 48h after this if they still don't verify."
        : "The nightly job warns first and will not release a slot it has never warned about.",
    });
  }

  // ---------------------------------------------------------- post-session
  steps.push({
    key: "post_session",
    label: "Post-session follow-up emailed",
    state: b.post_session_sent_at
      ? "done"
      : cancelled
        ? "na"
        : !ended
          ? "pending"
          : now - new Date(b.end_time).getTime() > 36 * HOUR
            ? "failed"
            : "pending",
    at: b.post_session_sent_at,
    detail: b.post_session_sent_at
      ? "Also what marks the booking completed and mints any play-time reward."
      : cancelled
        ? "Booking cancelled."
        : !ended
          ? "Goes out on the daily cron after the session ends."
          : now - new Date(b.end_time).getTime() > 36 * HOUR
            ? "The session ended more than a day ago and no follow-up went out. Check the post-session cron."
            : "Due on the next daily cron run.",
  });

  return steps;
}
