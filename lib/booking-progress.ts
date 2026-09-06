import type { BookingStatus, PaymentStatus } from "./types";

/**
 * Where a booking is up to, told to the person who made it.
 *
 * DELIBERATELY NOT `lib/automation.ts`. That file answers the admin's question
 * — "did every automated step actually run, and if not, which one broke?" — and
 * its honesty is the point: it says "TTLock refused 3 times" and "no record".
 * None of that is a customer's business or a customer's problem. This answers a
 * different question: *what's happened, what's next, and is anything waiting on
 * me?* Merging the two would mean either leaking operational failures into a
 * customer's inbox or blunting the admin panel. So: same underlying columns,
 * two separate readings.
 *
 * Pure, and derived only from columns already on the booking plus one boolean
 * about the customer — so it costs no queries wherever it's rendered.
 */

export type ProgressState =
  /** Happened. */
  | "done"
  /** The thing currently in flight — at most one step is ever `current`. */
  | "current"
  /** Still ahead. */
  | "upcoming"
  /** Never going to apply to this booking. */
  | "skipped";

export type ProgressStep = {
  key: string;
  label: string;
  state: ProgressState;
  /** One line: what happened, or what happens next. */
  detail: string;
  /**
   * Set when the ball is in the customer's court. Rendered as a callout rather
   * than a quiet line — this is the only reason the component exists.
   */
  waitingOnYou?: boolean;
};

export type BookingProgress = {
  steps: ProgressStep[];
  /** Headline for the whole booking, above the steps. */
  headline: string;
  /** Null unless something is genuinely waiting on the customer. */
  action: string | null;
  cancelled: boolean;
};

export type ProgressInput = {
  status: BookingStatus;
  payment_status: PaymentStatus;
  start_time: string;
  end_time: string;
  /** Stamped when the "how to get in" email went out. */
  access_sent_at?: string | null;
  /** Whether this customer's ID has been checked (permanent, once done). */
  idVerified: boolean;
  /**
   * Whether they've actually uploaded through the emailed link yet.
   *
   * The difference matters to the person reading this and to nobody else: an
   * unverified customer who has uploaded is waiting on *us*, and telling them
   * "over to you" would be a lie. Optional so callers without the
   * `id_verifications` row still get the honest default — waiting on them.
   */
  idSubmitted?: boolean;
  /** Paid entirely from banked hours — there is nothing left to pay. */
  banked?: boolean;
};

export function bookingProgress(b: ProgressInput, now: number = Date.now()): BookingProgress {
  const started = new Date(b.start_time).getTime() <= now;
  const ended = new Date(b.end_time).getTime() <= now;
  const cancelled = b.status === "cancelled";
  const paid = b.payment_status === "paid" || b.payment_status === "comped" || b.banked === true;
  const confirmed = b.status === "confirmed" || b.status === "completed";
  const missed = b.status === "no_show";

  if (cancelled) {
    return {
      cancelled: true,
      headline: "This booking was cancelled.",
      action: null,
      steps: [
        {
          key: "cancelled",
          label: "Cancelled",
          state: "done",
          detail: "The slot went back on sale. Nothing further is owed.",
        },
      ],
    };
  }

  const steps: ProgressStep[] = [];

  // 1 ---------------------------------------------------------------- booked
  steps.push({
    key: "booked",
    label: "Booked",
    state: "done",
    detail: "We've got your session and emailed you the details.",
  });

  // 2 ------------------------------------------------------------------ ID
  // Only ever a step for a first-timer. Once checked it's permanent, so a
  // returning customer shouldn't see a box about it at all — showing a green
  // tick for something they did months ago is noise.
  //
  // THE ID MUST BE UPLOADED. There is no "bring it on the day" path any more:
  // an unverified booking is `pending_verification` and nothing downstream
  // (confirmation, payment, door code) happens until an admin approves an
  // upload. Copy that offered the door as an alternative was writing a cheque
  // the rest of the system doesn't cash — someone would turn up with a licence
  // in their pocket to a session that had never been confirmed.
  if (b.idVerified) {
    steps.push({
      key: "id",
      label: "ID checked",
      state: "done",
      detail: "Done once, and it stays done — future sessions confirm straight away.",
    });
  } else if (confirmed) {
    // Confirmed without the flag: a walk-in keyed through admin Quick book.
    steps.push({ key: "id", label: "ID check", state: "done", detail: "Cleared." });
  } else if (b.idSubmitted) {
    // Uploaded and sitting with us. Not `waitingOnYou` — chasing someone for
    // something they've already sent is how you get a reply saying "I did".
    steps.push({
      key: "id",
      label: "ID check",
      state: "current",
      detail: "Got your ID, thanks — we're checking it now and you'll get a confirmation email once it's cleared.",
    });
  } else {
    steps.push({
      key: "id",
      label: "ID check",
      state: "current",
      detail:
        "Your session isn't confirmed until we've seen photo ID. Upload a photo of your driver licence or passport — on your booking page, or through the link we email you — it takes a minute, it's a one-off, and it has to be done before the day.",
      waitingOnYou: true,
    });
  }

  // 3 ------------------------------------------------------------- confirmed
  steps.push({
    key: "confirmed",
    label: "Confirmed",
    state: confirmed ? "done" : b.idVerified ? "current" : "upcoming",
    detail: confirmed
      ? "Your slot is locked in."
      : "We'll confirm the slot as soon as your ID is checked.",
  });

  // 4 ------------------------------------------------------------- payment
  steps.push({
    key: "paid",
    label: b.banked ? "Paid with banked hours" : "Paid",
    state: paid ? "done" : confirmed ? "current" : "upcoming",
    detail: b.banked
      ? "Drawn from your banked hours — nothing to pay on the day."
      : paid
        ? "Received, thanks."
        : "Payable in person on the day, unless we've invoiced you.",
  });

  // 5 -------------------------------------------------------------- access
  // Phrased as "how to get in" rather than "door code" because the code itself
  // arrives in a separate email from the lock system, and promising a code in a
  // step that only tracks the instructions email is how someone ends up at a
  // keypad with nothing to type.
  //
  // Once the session is over, an unsent one is `skipped`, not `current`: the
  // email only goes out while there's still a session to get into (a payment
  // squared up afterwards sends nothing — see lib/booking-paid.ts), and leaving
  // this step lit would promise an email that is never coming.
  steps.push({
    key: "access",
    label: "How to get in",
    state: b.access_sent_at ? "done" : ended ? "skipped" : paid ? "current" : "upcoming",
    detail: b.access_sent_at
      ? "Sent — check your inbox. Your door code comes in its own email."
      : ended
        ? "Nothing to send — your session's already been."
        : "Once payment's settled we'll email where to go and your door code.",
  });

  // 6 ------------------------------------------------------------- session
  steps.push({
    key: "session",
    label: ended ? "Session" : "Your session",
    state: ended ? "done" : started ? "current" : "upcoming",
    detail: ended
      ? "Hope it went well."
      : started
        ? "On now — enjoy it."
        : "Bring a USB with your tracks and your own headphones.",
  });

  // 7 ----------------------------------------------------------- completed
  if (ended) {
    steps.push({
      key: "completed",
      label: missed ? "Marked as missed" : "Hours added",
      state: b.status === "completed" || missed ? "done" : "current",
      detail: missed
        ? "You didn't make this one, so it doesn't count toward your play time."
        : b.status === "completed"
          ? "Counted toward your play time and any reward you've earned."
          : "We'll tot these hours up shortly.",
    });
  }

  const waiting = steps.find((s) => s.waitingOnYou);

  return {
    cancelled: false,
    steps,
    headline: missed
      ? "You missed this one."
      : b.status === "completed"
        ? "All done."
        : ended
          ? "Session's been and gone."
          : started
            ? "Your session is on now."
            : confirmed
              ? "You're booked."
              : "Almost there.",
    action: waiting ? waiting.detail : null,
  };
}
