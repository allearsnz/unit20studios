import { createElement } from "react";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import BookingAccessInstructions from "@/emails/BookingAccessInstructions";
import { sendEmail, notifyAdmin, icsAttachment } from "./email";
import { createAdminClient } from "./supabase/admin";
import { buildBookingIcs } from "./ics";
import { formatBookingWhen } from "./timezone";
import { formatNZD } from "./pricing";
import { site } from "./site";
import type { Booking, Customer, PricingTier } from "./types";

/** Customer confirmation/receipt + admin notification for a new booking. */
export async function sendBookingCreatedEmails(opts: {
  booking: Booking;
  customer: Customer;
  tier: Pick<PricingTier, "label">;
  pending: boolean;
}) {
  const { booking, customer, tier, pending } = opts;
  const firstName = customer.name.split(/\s+/)[0] || "there";
  const whenLabel = formatBookingWhen(booking.start_time, booking.end_time);
  const total = formatNZD(booking.total_price_cents);
  const manageUrl = `${site.url}/studio/book/confirmation?id=${booking.friendly_id}`;

  const props = {
    firstName,
    friendlyId: booking.friendly_id,
    whenLabel,
    durationHours: booking.duration_hours,
    tierLabel: tier.label,
    groupSize: booking.group_size,
    total,
    manageUrl,
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
    `Total: ${total}`,
    `Status: ${booking.status}${pending ? " (NEW CUSTOMER — needs verification)" : ""}`,
    `Source: ${booking.source || "direct"}`,
    "",
    `${site.url}/admin/bookings/${booking.id}`,
  ].join("\n");

  await notifyAdmin(
    `New booking [${booking.status === "confirmed" ? "CONFIRMED" : "PENDING"}] — ${booking.friendly_id} ${customer.name}`,
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
 * This is the ONLY place the access email is sent. It is invoked from the
 * `bookings` "paid" Database Webhook (POST /api/hooks/booking-paid).
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
  // back, another caller got there first — nothing more to do.
  const now = new Date().toISOString();
  const { data: claimed } = await supabase
    .from("bookings")
    .update({ access_sent_at: now })
    .eq("id", bookingId)
    .is("access_sent_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { status: "already_sent", friendlyId: booking.friendly_id };

  const email = booking.customer?.email;
  if (!email) {
    // No address to send to — release the claim so it can be retried once the
    // customer record is fixed up.
    await supabase.from("bookings").update({ access_sent_at: null }).eq("id", bookingId);
    return { status: "no_email", friendlyId: booking.friendly_id };
  }

  const firstName = booking.customer?.name?.split(/\s+/)[0] || "there";
  const result = await sendEmail({
    to: email,
    subject: `You're all set — getting into Unit 20 (${booking.friendly_id})`,
    react: createElement(BookingAccessInstructions, {
      firstName,
      friendlyId: booking.friendly_id,
      whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
    }),
  });

  if (!result.ok) {
    // Roll back the claim so the send can be retried (e.g. resend from the crew
    // tab or a webhook redelivery). sendEmail never throws.
    await supabase.from("bookings").update({ access_sent_at: null }).eq("id", bookingId);
    return { status: "send_failed", friendlyId: booking.friendly_id, error: result.error };
  }

  return { status: "sent", friendlyId: booking.friendly_id };
}
