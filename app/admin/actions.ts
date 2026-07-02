"use server";

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, icsAttachment } from "@/lib/email";
import { buildBookingIcs } from "@/lib/ics";
import { formatBookingWhen, nzWallToUtc } from "@/lib/timezone";
import { calcPriceCents, formatNZDPlusGstIncl } from "@/lib/pricing";
import { normalizeNZPhone } from "@/lib/validation";
import { site } from "@/lib/site";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import BookingCancelled from "@/emails/BookingCancelled";
import type { Booking, BookingStatus, Customer, PaymentStatus, PricingTier } from "@/lib/types";

type FullBooking = Booking & { customer: Customer; pricing_tier: PricingTier };

async function getFullBooking(id: string): Promise<FullBooking | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, customer:customers(*), pricing_tier:pricing_tiers(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as FullBooking | null) ?? null;
}

function emailProps(b: FullBooking) {
  return {
    firstName: b.customer.name.split(/\s+/)[0] || "there",
    friendlyId: b.friendly_id,
    whenLabel: formatBookingWhen(b.start_time, b.end_time),
    durationHours: b.duration_hours,
    tierLabel: b.pricing_tier.label,
    groupSize: b.group_size,
    total: formatNZDPlusGstIncl(b.total_price_cents),
    manageUrl: `${site.url}/studio/book/confirmation?id=${b.friendly_id}`,
  };
}

export async function setBookingStatus(id: string, status: BookingStatus) {
  await assertAdmin();
  const supabase = createAdminClient();

  if (status === "confirmed") {
    // Atomically claim the pending → confirmed transition so the customer
    // confirmation email is sent exactly once, even on double-clicks or
    // concurrent admins. Any other transition to "confirmed" (e.g. undoing a
    // "completed") just updates the row without re-emailing.
    const { data: transitioned } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .eq("status", "pending_verification")
      .select("id")
      .maybeSingle();

    if (transitioned) {
      const booking = await getFullBooking(id);
      if (booking?.customer.email) {
        const ics = buildBookingIcs(booking);
        await sendEmail({
          to: booking.customer.email,
          subject: `You're booked — ${booking.friendly_id}`,
          react: createElement(BookingConfirmed, emailProps(booking)),
          attachments: ics ? [icsAttachment(`unit20-${booking.friendly_id}.ics`, ics)] : undefined,
        });
      }
    } else {
      await supabase.from("bookings").update({ status }).eq("id", id);
    }
  } else {
    await supabase.from("bookings").update({ status }).eq("id", id);
  }

  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
}

export async function setPaymentStatus(id: string, payment_status: PaymentStatus) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("bookings").update({ payment_status }).eq("id", id);
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
}

export async function saveInternalNote(id: string, note: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("bookings").update({ internal_note: note }).eq("id", id);
  revalidatePath(`/admin/bookings/${id}`);
}

export async function verifyCustomer(customerId: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase
    .from("customers")
    .update({ id_verified: true, id_verified_at: new Date().toISOString() })
    .eq("id", customerId);
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

export async function cancelBooking(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);

  const booking = await getFullBooking(id);
  if (booking?.customer.email) {
    await sendEmail({
      to: booking.customer.email,
      subject: `Your booking ${booking.friendly_id} has been cancelled`,
      react: createElement(BookingCancelled, {
        firstName: booking.customer.name.split(/\s+/)[0] || "there",
        friendlyId: booking.friendly_id,
        whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
        bookUrl: `${site.url}/studio/book`,
      }),
    });
  }
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
}

export async function resendConfirmation(id: string) {
  await assertAdmin();
  const booking = await getFullBooking(id);
  if (!booking?.customer.email) return;
  const props = emailProps(booking);
  if (booking.status === "confirmed" || booking.status === "completed") {
    const ics = buildBookingIcs(booking);
    await sendEmail({
      to: booking.customer.email,
      subject: `You're booked — ${booking.friendly_id}`,
      react: createElement(BookingConfirmed, props),
      attachments: ics ? [icsAttachment(`unit20-${booking.friendly_id}.ics`, ics)] : undefined,
    });
  } else {
    await sendEmail({
      to: booking.customer.email,
      subject: `We've got your booking request — ${booking.friendly_id}`,
      react: createElement(BookingReceivedNewCustomer, props),
    });
  }
}

export async function createBlackout(formData: FormData) {
  await assertAdmin();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!start || !end) return;
  const startUtc = nzLocalInputToUtc(start);
  const endUtc = nzLocalInputToUtc(end);
  if (!startUtc || !endUtc || endUtc <= startUtc) return;

  const supabase = createAdminClient();
  await supabase.from("blackout_periods").insert({
    start_time: startUtc.toISOString(),
    end_time: endUtc.toISOString(),
    reason,
  });
  revalidatePath("/admin/blackouts");
}

export async function deleteBlackout(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("blackout_periods").delete().eq("id", id);
  revalidatePath("/admin/blackouts");
}

/** Parse a datetime-local value ("YYYY-MM-DDTHH:mm") as NZ wall time → UTC. */
function nzLocalInputToUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return nzWallToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

export async function quickBook(formData: FormData) {
  await assertAdmin();
  const supabase = createAdminClient();

  const name = String(formData.get("name") ?? "").trim() || "Walk-in";
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const startInput = String(formData.get("start") ?? "");
  const durationHours = Math.max(1, Math.min(8, Number(formData.get("durationHours") ?? 1)));
  // Single flat tier — the legacy "large" tier is retired. Bigger groups are
  // arranged by email; admin can still key the true headcount here.
  const tierSlug = "small";
  const groupSize = Math.max(1, Math.min(10, Number(formData.get("groupSize") ?? 1)));
  const markPaid = formData.get("markPaid") === "on";
  const doEmail = formData.get("sendEmail") === "on";

  const start = nzLocalInputToUtc(startInput);
  if (!start) return;
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);

  const { data: tierRow } = await supabase.from("pricing_tiers").select("*").eq("slug", tierSlug).maybeSingle();
  if (!tierRow) return;
  const tier = tierRow as PricingTier;
  // Start time applies the weekday-daytime 2h deal ($60+GST) when it fits.
  const total = calcPriceCents(tier, durationHours, start);

  const email = rawEmail || `walkin-${Date.now()}@unit20.local`;
  const phone = rawPhone ? (normalizeNZPhone(rawPhone) ?? rawPhone) : "—";

  const { data: existing } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
  let customer: Customer;
  if (existing) {
    customer = existing as Customer;
  } else {
    const { data: created } = await supabase
      .from("customers")
      .insert({ email, name, phone, dob: "2000-01-01", id_verified: true, id_verified_at: new Date().toISOString() })
      .select("*")
      .single();
    customer = created as Customer;
  }

  const { data: bookingRow, error } = await supabase.rpc("create_booking_slot", {
    p_customer_id: customer.id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_duration_hours: durationHours,
    p_pricing_tier_id: tier.id,
    p_group_size: groupSize,
    p_total_price_cents: total,
    p_is_peak: false,
    p_status: "confirmed",
    p_source: "walk-in",
    p_customer_note: null,
  });
  if (error || !bookingRow) return;
  const booking = bookingRow as Booking;

  if (markPaid) {
    await supabase.from("bookings").update({ payment_status: "paid" }).eq("id", booking.id);
  }

  if (doEmail && rawEmail) {
    await sendEmail({
      to: rawEmail,
      subject: `You're booked — ${booking.friendly_id}`,
      react: createElement(BookingConfirmed, {
        firstName: name.split(/\s+/)[0] || "there",
        friendlyId: booking.friendly_id,
        whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
        durationHours,
        tierLabel: tier.label,
        groupSize,
        total: formatNZDPlusGstIncl(total),
        manageUrl: `${site.url}/studio/book/confirmation?id=${booking.friendly_id}`,
      }),
    });
  }

  revalidatePath("/admin");
  redirect(`/admin/bookings/${booking.id}`);
}
