import { createAdminClient } from "@/lib/supabase/admin";
import { formatBookingWhen } from "@/lib/timezone";
import { gstInclusiveCents } from "@/lib/pricing";
import { runPaidAutomations } from "@/lib/booking-paid";
import {
  type CheckoutSession,
  bookingIdFromSession,
  createBookingCheckoutSession,
  stripeConfigured,
} from "@/lib/stripe";

/**
 * ONE BOOKING, ONE PAYMENT LINK — and one place that turns a Stripe payment
 * into `payment_status = 'paid'`.
 *
 * `lib/stripe.ts` knows about Stripe and nothing about bookings. This knows
 * about both, and it is deliberately the only module that does, for the same
 * reason `lib/admin-ops.ts` exists: there are already two callers (the studio
 * admin's own action and the crew app's `POST /api/admin/bookings/:id/
 * payment-link`) and there will be a third the day the public booking form
 * starts taking payment up front. A second implementation is how one of them
 * quietly stops charging GST.
 *
 * THE ORDER IS MONEY → BOOKING → BOOKS, and it is not negotiable
 * (`PLAN-studio-prepay.md` §4). `recordStripePayment` marks the booking paid
 * and returns; the door code and the access email hang off that flag through
 * machinery that already exists. Nothing about writing the books is on the
 * customer's path — a Xero outage must never be the reason somebody is standing
 * outside a locked roller door at 8pm.
 */

export type PaymentLinkResult =
  | { status: "ok"; url: string; expiresAt: number; amountCents: number; friendlyId: string }
  | { status: "not_configured" }
  | { status: "not_found" }
  | { status: "cancelled" }
  | { status: "already_paid"; friendlyId: string }
  | { status: "nothing_to_pay"; friendlyId: string }
  | { status: "failed"; error: string };

type BookingRow = {
  id: string;
  friendly_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_price_cents: number;
  status: string;
  payment_status: string;
  customer: { email: string | null } | { email: string | null }[] | null;
};

function firstCustomer(row: BookingRow): { email: string | null } | null {
  const c = row.customer;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

/**
 * Mint a Checkout link for a booking that already exists.
 *
 * Every refusal below is a REFUSAL, not a failure — each one has a sentence a
 * person can act on, because the alternative is a button that throws and a
 * screen that says "something went wrong". The three that matter:
 *
 *   * `already_paid` — pressing it twice must not be able to charge twice. This
 *     is read at mint time AND re-read in the webhook, because a link sent
 *     before a cash payment could still be opened afterwards.
 *   * `cancelled` — a cancelled slot is not for sale. Taking money for one is
 *     a refund and an apology.
 *   * `nothing_to_pay` — a $0 booking is a banked-hours session or a comp.
 *     Stripe rejects a zero-amount session anyway; saying so plainly is better
 *     than surfacing Stripe's wording.
 */
export async function createPaymentLinkForBooking(
  bookingId: string,
): Promise<PaymentLinkResult> {
  if (!stripeConfigured()) return { status: "not_configured" };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, friendly_id, start_time, end_time, duration_hours, total_price_cents," +
        " status, payment_status, customer:customers(email)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  const booking = data as BookingRow | null;
  if (!booking) return { status: "not_found" };
  if (booking.status === "cancelled") return { status: "cancelled" };
  if (booking.payment_status === "paid" || booking.payment_status === "comped") {
    return { status: "already_paid", friendlyId: booking.friendly_id };
  }
  if (booking.total_price_cents <= 0) {
    return { status: "nothing_to_pay", friendlyId: booking.friendly_id };
  }

  try {
    const session = await createBookingCheckoutSession({
      id: booking.id,
      friendly_id: booking.friendly_id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      duration_hours: booking.duration_hours,
      total_price_cents: booking.total_price_cents,
      customerEmail: firstCustomer(booking)?.email ?? null,
      whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
    });
    if (!session.url) return { status: "failed", error: "Stripe returned no checkout URL." };
    return {
      status: "ok",
      url: session.url,
      expiresAt: session.expires_at,
      amountCents: gstInclusiveCents(booking.total_price_cents),
      friendlyId: booking.friendly_id,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Stripe refused that.";
    console.error("[stripe-booking] checkout session failed", { bookingId, error });
    return { status: "failed", error };
  }
}

// ---------------------------------------------------------------------------

export type RecordPaymentResult =
  | { status: "recorded"; bookingId: string; friendlyId: string }
  | { status: "already_paid"; bookingId: string }
  | { status: "not_our_session" }
  | { status: "unpaid_session" }
  | { status: "booking_missing"; bookingId: string }
  /** Money taken for a slot that no longer exists. Never marked paid — this
   *  needs a human and a refund, so it is logged loudly and reported. */
  | { status: "paid_but_cancelled"; bookingId: string; friendlyId: string };

/**
 * A completed Checkout Session becomes a paid booking.
 *
 * THE CLAIM IS THE `neq('payment_status', 'paid')` FILTER, exactly as
 * `setPaymentStatus` does it. Stripe delivers webhooks at least once and will
 * happily send `checkout.session.completed` twice; the `success_url` fast path
 * calls this as well. Only the UPDATE that actually MOVES the row returns one,
 * and only that call runs the automations — so two deliveries send one access
 * email and mint one door code, without either path needing to know the other
 * exists.
 *
 * `paid_but_cancelled` is the one outcome that does not write anything. A slot
 * cancelled between the link being sent and the customer paying is somebody's
 * money for nothing; marking it paid would mint a door code for a session that
 * is not happening and tell the customer to turn up.
 */
export async function recordStripePayment(
  session: CheckoutSession,
): Promise<RecordPaymentResult> {
  const bookingId = bookingIdFromSession(session);
  if (!bookingId) return { status: "not_our_session" };
  if (session.payment_status !== "paid") return { status: "unpaid_session" };

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("bookings")
    .select("id, friendly_id, status, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = existing as
    | { id: string; friendly_id: string; status: string; payment_status: string }
    | null;

  if (!booking) {
    console.error("[stripe-booking] paid session for an unknown booking", {
      bookingId,
      sessionId: session.id,
    });
    return { status: "booking_missing", bookingId };
  }
  if (booking.status === "cancelled") {
    console.error("[stripe-booking] PAYMENT RECEIVED FOR A CANCELLED BOOKING — refund needed", {
      bookingId,
      friendlyId: booking.friendly_id,
      sessionId: session.id,
      paymentIntent: session.payment_intent,
    });
    return { status: "paid_but_cancelled", bookingId, friendlyId: booking.friendly_id };
  }

  const { data: transitioned } = await supabase
    .from("bookings")
    .update({
      payment_status: "paid",
      payment_method: "stripe",
      stripe_payment_intent_id: session.payment_intent,
      paid_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .neq("payment_status", "paid")
    .select("id, friendly_id")
    .maybeSingle();

  if (!transitioned) return { status: "already_paid", bookingId };

  // Door code + access instructions. Safe to run twice by design, and the
  // Supabase Database Webhook on `bookings` will also fire on the UPDATE above
  // — running it here as well means this path does not depend on a webhook
  // configured in a dashboard neither repo can read.
  await runPaidAutomations(bookingId);

  return {
    status: "recorded",
    bookingId,
    friendlyId: (transitioned as { friendly_id: string }).friendly_id,
  };
}
