import { sendAccessInstructions, type AccessSendResult } from "./notifications";
import { createAdminClient } from "./supabase/admin";

/**
 * Everything that fires when a studio booking becomes PAID, in one place.
 *
 * WHY THIS EXISTS AS A FUNCTION. Payment used to be the trigger for two emails
 * that nothing in the admin UI mentioned, sent by a path the admin could not
 * see: a Supabase **Database Webhook** on `bookings` UPDATE POSTs to
 * /api/hooks/booking-paid, which does the work. That webhook is configured in
 * the Supabase dashboard, not in this repo — so if it is missing, misconfigured
 * or its bearer token has drifted from BOOKING_HOOK_SECRET, clicking "paid"
 * silently sends nothing and the customer turns up to a locked roller door.
 * Nobody finds out until they do.
 *
 * So the admin action now calls this directly as well, and shows the admin what
 * came back. The webhook path is deliberately left in place: it is the only
 * thing covering payments that land from Xero or from the crew app's Studio
 * tab, neither of which runs this code. Both paths converge here, and running
 * twice is harmless — `sendAccessInstructions` claims the send atomically, and
 * the door-code mint is guarded by `emailed_at` inside the edge function.
 *
 * Best-effort throughout: nothing in here throws, because a failed email must
 * never leave the booking un-marked as paid.
 *
 * AND IT ONLY RUNS WHILE THERE IS STILL A SESSION TO GET INTO — see
 * `skipReason`. Payment on a finished or cancelled booking is bookkeeping, and
 * marking it paid sends nothing.
 */

export type PaidAutomationResult = {
  /** What the access-instructions email did — null when it wasn't sent at all. */
  access: AccessSendResult | null;
  /**
   * Whether the door-code mint was successfully *kicked*. This is NOT "a code
   * exists" — the edge function mints asynchronously against TTLock and records
   * its own outcome on `studio_door_codes`. The Automation tab reads that row;
   * this flag only says whether we managed to ask.
   */
  doorCodeKicked: boolean;
  /** Set when nothing was sent, and why. Null when the chain actually ran. */
  skipped: PaidSkipReason | null;
};

/**
 * Why a payment sent nothing.
 *
 * Both are the same shape of fact: there is no session left to let anyone into.
 * A booking squared up after the fact is bookkeeping, and a cancelled one is
 * void — neither customer needs directions to a room they aren't going to.
 */
export type PaidSkipReason = "session_ended" | "cancelled";

/**
 * Mint + email the studio door code the moment payment lands. The crew-side DB
 * trigger (crew migration 0050) already INSERTs a *pending* studio_door_codes
 * row on payment_status → paid; this kicks the `issue-studio-door-code` edge
 * function to mint it against TTLock and email the customer their code now,
 * rather than waiting for the per-minute cron (crew 0051).
 *
 * `process_pending` mints every pending row, not just this booking's. That is
 * deliberate and is the only option available to us: the per-booking mode of
 * that function requires a crew JWT holding `doorcodes.manage`, which the
 * studio app does not have and should not get. Minting someone else's already-
 * pending code early is harmless — the cron would have done it within a minute.
 */
export async function issuePendingDoorCodes(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // Service-role JWT satisfies the function's verify_jwt.
    const { error } = await supabase.functions.invoke("issue-studio-door-code", {
      body: { process_pending: true },
    });
    if (error) {
      console.error("[booking-paid] door-code mint failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[booking-paid] door-code mint failed", e);
    return false;
  }
}

/**
 * Has this payment landed too late to be worth telling the customer about?
 *
 * The crew-side trigger already answers this for the door code: it only
 * enqueues one while `end_time > now()` and never for a cancelled booking, so a
 * session squared up afterwards silently gets no code. The access email had no
 * such rule and went out regardless — which meant reconciling last month's
 * unpaid session emailed that customer directions, a "your code arrives
 * separately" line that was never true, and a bring-your-headphones list for a
 * night they had already played. Marking paid after the fact is bookkeeping.
 *
 * So the same condition now gates the whole chain, and it is read from the row
 * rather than passed in, because both callers (this app's admin action and the
 * paid Database Webhook, which covers Xero and the crew Studio tab) must reach
 * the same answer.
 */
async function skipReason(bookingId: string): Promise<PaidSkipReason | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("bookings")
      .select("end_time, status")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = data as { end_time: string; status: string } | null;
    if (!booking) return null; // Unreadable: fall through and let the sender report it.
    if (booking.status === "cancelled") return "cancelled";
    if (new Date(booking.end_time).getTime() <= Date.now()) return "session_ended";
    return null;
  } catch (e) {
    // A failed read must not turn into a silently-skipped send.
    console.error("[booking-paid] couldn't read booking to check timing", e);
    return null;
  }
}

/** Run the post-payment chain for one booking. Never throws. */
export async function runPaidAutomations(bookingId: string): Promise<PaidAutomationResult> {
  const skipped = await skipReason(bookingId);
  if (skipped) return { access: null, doorCodeKicked: false, skipped };

  // Door code first: it is the thing with a deadline (an offline TTLock code
  // has to exist before the customer is standing at the keypad), and the access
  // email's "your code arrives separately" line is only true if we've asked.
  const doorCodeKicked = await issuePendingDoorCodes();

  let access: AccessSendResult;
  try {
    access = await sendAccessInstructions(bookingId);
  } catch (e) {
    // sendAccessInstructions is not supposed to throw, but this function is
    // called from a server action rendering a button — a stray throw here would
    // surface as a failed action on a payment that DID save.
    console.error("[booking-paid] access instructions threw", e);
    access = { status: "send_failed", friendlyId: "", error: e instanceof Error ? e.message : "unknown" };
  }

  return { access, doorCodeKicked, skipped: null };
}
