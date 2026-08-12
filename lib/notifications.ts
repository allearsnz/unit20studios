import { createElement } from "react";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import BookingAccessInstructions from "@/emails/BookingAccessInstructions";
import { sendEmail, notifyAdmin, icsAttachment } from "./email";
import { createAdminClient } from "./supabase/admin";
import { buildBookingIcs } from "./ics";
import { formatBookingWhen } from "./timezone";
import { BULK_PACK, formatNZDPlusGst, formatNZDPlusGstIncl } from "./pricing";
import { site } from "./site";
import type { Booking, Customer, PricingTier } from "./types";

/** Customer confirmation/receipt + admin notification for a new booking. */
export async function sendBookingCreatedEmails(opts: {
  booking: Booking;
  customer: Customer;
  tier: Pick<PricingTier, "label">;
  pending: boolean;
  /** Rate line for the receipt, e.g. "10-hour pack — first 2h booked". */
  rateNote?: string | null;
  /** Ex-GST group surcharge included in the total (0 = none). */
  surchargeCents?: number;
  /** True when this is a 10-hour pack booking (first session). */
  isPack?: boolean;
}) {
  const { booking, customer, tier, pending, rateNote, surchargeCents = 0, isPack } = opts;
  const firstName = customer.name.split(/\s+/)[0] || "there";
  const whenLabel = formatBookingWhen(booking.start_time, booking.end_time);
  const total = formatNZDPlusGstIncl(booking.total_price_cents);
  const manageUrl = `${site.url}/studio/book/confirmation?id=${booking.friendly_id}`;
  const surchargeLabel = surchargeCents > 0 ? `+${formatNZDPlusGst(surchargeCents)}` : null;
  const packNote = isPack
    ? `You're on the 10-hour pack (${formatNZDPlusGst(BULK_PACK.totalCents)}). This booking uses the first ${booking.duration_hours} hours — we'll be in touch to sort the rest of your hours across future visits.`
    : null;

  const props = {
    firstName,
    friendlyId: booking.friendly_id,
    whenLabel,
    durationHours: booking.duration_hours,
    tierLabel: tier.label,
    groupSize: booking.group_size,
    total,
    manageUrl,
    rateNote: rateNote ?? null,
    surchargeLabel,
    packNote,
    // Only prompt people who haven't got an account. `auth_user_id` is stamped
    // the moment a customers row is linked to a sign-in, so its absence is the
    // whole test — and it means a customer who signs up later stops being asked.
    signupUrl: customer.auth_user_id ? null : `${site.url}/account/signup`,
  };

  if (pending) {
    await sendEmail({
      to: customer.email,
      subject: `We've got your booking request — ${booking.friendly_id}`,
      react: createElement(BookingReceivedNewCustomer, props),
    });
  } else {
    const ics = buildBookingIcs(booking);
    await sendEmail({
      to: customer.email,
      subject: `You're booked — ${booking.friendly_id}`,
      react: createElement(BookingConfirmed, props),
      attachments: ics ? [icsAttachment(`unit20-${booking.friendly_id}.ics`, ics)] : undefined,
    });
  }

  const text = [
    customer.name,
    `${customer.email} · ${customer.phone}`,
    `${whenLabel} (${booking.duration_hours}h)`,
    `${tier.label}, ${booking.group_size} people`,
    ...(rateNote ? [`Rate: ${rateNote}`] : []),
    ...(surchargeLabel ? [`Group surcharge: ${surchargeLabel} (included in total)`] : []),
    ...(isPack
      ? [`10-HOUR PACK — first session only; ${BULK_PACK.packHours - booking.duration_hours}h remain to arrange.`]
      : []),
    `Total: ${total}`,
    `Status: ${booking.status}${pending ? " (NEW CUSTOMER — needs verification)" : ""}`,
    `Source: ${booking.source || "direct"}`,
    "",
    `${site.url}/admin/bookings/${booking.id}`,
  ].join("\n");

  await notifyAdmin(
    `New booking${isPack ? " [10H PACK]" : ""} [${booking.status === "confirmed" ? "CONFIRMED" : "PENDING"}] — ${booking.friendly_id} ${customer.name}`,
    text,
  );
}

export type AccessSendResult =
  | { status: "sent"; friendlyId: string }
  | { status: "already_sent"; friendlyId: string }
  | { status: "not_found" }
  | { status: "no_email"; friendlyId: string }
  | { status: "send_failed"; friendlyId: string; error?: string };

/**
 * Send the post-payment access-instructions email exactly once.
 *
 * Idempotent by design: it atomically *claims* the booking by stamping
 * `access_sent_at = now()` only while it is still null (so two concurrent
 * callers — e.g. the Xero webhook and a manual "mark paid" — can't both send).
 * The caller that wins the claim sends the email; if that send fails the claim
 * is rolled back so a later retry can try again. All other callers no-op.
 *
 * THE CLAIM IS NOT A RECORD. Rolling `access_sent_at` back on failure is the
 * right retry behaviour and, on its own, the wrong audit trail: it leaves the
 * row byte-identical to a booking nobody ever tried to email — and identical
 * again to one where the paid Database Webhook never fired at all. Three very
 * different faults (dead webhook / bad address / Resend refusing) all rendered
 * as one blank, which is exactly why nobody could tell whether a customer had
 * been let in. So every genuine attempt also stamps `access_last_attempt_at`
 * (migration 0014 / crew 0124), which is NEVER rolled back, plus the attempt
 * count and the sender's own error text. The admin panel classifies on those.
 *
 * This is the ONLY place the access email is sent. It is invoked from the
 * `bookings` "paid" Database Webhook (POST /api/hooks/booking-paid) and, so the
 * admin gets an answer while they are still looking at the screen, directly
 * from the "mark paid" action via `runPaidAutomations` (lib/booking-paid.ts).
 */
export async function sendAccessInstructions(bookingId: string): Promise<AccessSendResult> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("bookings")
    .select("*, customer:customers(*)")
    .eq("id", bookingId)
    .maybeSingle();

  const booking = data as (Booking & { customer: Customer | null }) | null;
  if (!booking) return { status: "not_found" };
  if (booking.access_sent_at) return { status: "already_sent", friendlyId: booking.friendly_id };

  // Atomically claim the send: stamp only if still unstamped. If no row comes
  // back, another caller got there first — nothing more to do. The attempt
  // bookkeeping rides along inside the claim, so only the winner counts an
  // attempt and the read-modify-write on the counter can't race itself.
  const now = new Date().toISOString();
  const { data: claimed } = await supabase
    .from("bookings")
    .update({
      access_sent_at: now,
      access_last_attempt_at: now,
      access_send_attempts: (booking.access_send_attempts ?? 0) + 1,
      access_send_error: null,
    })
    .eq("id", bookingId)
    .is("access_sent_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { status: "already_sent", friendlyId: booking.friendly_id };

  const email = booking.customer?.email;
  if (!email) {
    // No address to send to — release the claim so it can be retried once the
    // customer record is fixed up, but keep the attempt stamp and say why.
    // Without the reason this looks like a transient failure and someone
    // retries it forever; the fix is on the customer record, not here.
    await supabase
      .from("bookings")
      .update({ access_sent_at: null, access_send_error: "No email address on file" })
      .eq("id", bookingId);
    return { status: "no_email", friendlyId: booking.friendly_id };
  }

  // Does a door code actually exist for this booking? The crew-side trigger
  // (crew migration 0050) only enqueues one when the payment lands while
  // `end_time > now()` — so a session reconciled after the fact never gets a
  // code, and promising one would leave someone at a keypad with nothing to
  // type. This mirrors that condition exactly rather than guessing.
  const hasDoorCode = new Date(booking.end_time).getTime() > Date.now();

  const firstName = booking.customer?.name?.split(/\s+/)[0] || "there";
  const result = await sendEmail({
    to: email,
    subject: `You're all set — getting into Unit 20 (${booking.friendly_id})`,
    react: createElement(BookingAccessInstructions, {
      firstName,
      friendlyId: booking.friendly_id,
      whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
      hasDoorCode,
    }),
  });

  if (!result.ok) {
    // Roll back the claim so the send can be retried (e.g. the retry button on
    // the booking's Automation tab, or a webhook redelivery) — but leave the
    // attempt stamp standing and record why, so the failure is visible instead
    // of looking like a send that never happened. sendEmail never throws.
    await supabase
      .from("bookings")
      .update({ access_sent_at: null, access_send_error: result.error ?? "send_failed" })
      .eq("id", bookingId);
    return { status: "send_failed", friendlyId: booking.friendly_id, error: result.error };
  }

  return { status: "sent", friendlyId: booking.friendly_id };
}
