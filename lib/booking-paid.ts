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
 */

export type PaidAutomationResult = {
  /** What the access-instructions email did. */
  access: AccessSendResult;
  /**
   * Whether the door-code mint was successfully *kicked*. This is NOT "a code
   * exists" — the edge function mints asynchronously against TTLock and records
   * its own outcome on `studio_door_codes`. The Automation tab reads that row;
   * this flag only says whether we managed to ask.
   */
  doorCodeKicked: boolean;
};

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

/** Run the post-payment chain for one booking. Never throws. */
export async function runPaidAutomations(bookingId: string): Promise<PaidAutomationResult> {
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

  return { access, doorCodeKicked };
}
