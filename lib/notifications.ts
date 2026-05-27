import { createElement } from "react";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import { sendEmail, notifyAdmin, icsAttachment } from "./email";
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
    isPeak: booking.is_peak,
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
