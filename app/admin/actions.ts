"use server";

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, icsAttachment } from "@/lib/email";
import { buildBookingIcs } from "@/lib/ics";
import { formatBookingWhen, nzWallToUtc } from "@/lib/timezone";
import { calcPriceCents, formatNZDPlusGstIncl, groupSurchargeCents } from "@/lib/pricing";
import { normalizeNZPhone } from "@/lib/validation";
import { invoiceBooking } from "@/lib/xero-booking";
import { grantMilestoneRewards } from "@/lib/rewards";
import { creditBankedHours } from "@/lib/banked-hours";
import { site } from "@/lib/site";
import { formatNZ } from "@/lib/timezone";
import {
  DISCOUNT_EXPIRY_DAYS,
  generateUniqueCode,
  normalizeCode,
} from "@/lib/discounts";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import BookingCancelled from "@/emails/BookingCancelled";
import DiscountOffer from "@/emails/DiscountOffer";
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
      // Approving a booking raises its Xero invoice and has Xero email the
      // customer the pay-now link (best-effort; never throws). The door code is
      // NOT issued here — it now mints when payment lands (see the paid hook).
      await invoiceBooking(id);
    } else {
      await supabase.from("bookings").update({ status }).eq("id", id);
    }
  } else {
    await supabase.from("bookings").update({ status }).eq("id", id);
  }

  // Reaching 'completed' grows the customer's play time — mint any milestone
  // reward they just earned (idempotent; never throws).
  if (status === "completed") {
    const { data: row } = await supabase
      .from("bookings")
      .select("customer_id")
      .eq("id", id)
      .maybeSingle();
    const customerId = (row as { customer_id: string } | null)?.customer_id;
    if (customerId) await grantMilestoneRewards(supabase, customerId);
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

/**
 * Admin: manually adjust a customer's banked-hours balance (correction, comp,
 * or claw-back). Writes an `adjustment` ledger entry — negative deltas allowed
 * (admin may deliberately zero a mistaken pack), so this uses a plain insert
 * rather than the balance-guarded debit RPC.
 */
export async function adjustBankedHours(formData: FormData) {
  await assertAdmin();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const delta = Math.trunc(Number(formData.get("delta") ?? 0));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!customerId || !Number.isInteger(delta) || delta === 0) return;

  const supabase = createAdminClient();
  await creditBankedHours(supabase, {
    customerId,
    hours: delta,
    reason: "adjustment",
    note,
  });
  revalidatePath(`/admin/customers/${customerId}`);
}

export async function cancelBooking(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();

  // Give back any banked hours this booking drew — but only on the first
  // transition into 'cancelled', so re-cancelling can't double-refund.
  const { data: transitioned } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .neq("status", "cancelled")
    .select("customer_id, friendly_id, banked_hours_used")
    .maybeSingle();
  const t = transitioned as
    | { customer_id: string; friendly_id: string; banked_hours_used: number }
    | null;
  if (t && t.banked_hours_used > 0) {
    await creditBankedHours(supabase, {
      customerId: t.customer_id,
      hours: t.banked_hours_used,
      reason: "session_refund",
      bookingId: id,
      note: `Cancelled booking ${t.friendly_id}`,
    });
  }

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

/**
 * Manually (re)create the Xero invoice for a booking — for already-confirmed
 * unpaid bookings, or to retry after a transient Xero failure. Best-effort:
 * `invoiceBooking` never throws and no-ops if the booking is already invoiced.
 */
export async function createInvoiceForBooking(id: string) {
  await assertAdmin();
  const result = await invoiceBooking(id);
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
  return result;
}

/** "HH:MM" → minutes from midnight, or null if malformed. */
function hhmmToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  const total = h * 60 + min;
  return total >= 0 && total <= 1440 ? total : null;
}

export async function createRecurringBlackout(formData: FormData) {
  await assertAdmin();
  const days = formData
    .getAll("day")
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const startMin = hhmmToMinutes(String(formData.get("start_time") ?? ""));
  const endMin = hhmmToMinutes(String(formData.get("end_time") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (days.length === 0 || startMin == null || endMin == null || endMin <= startMin) return;

  const supabase = createAdminClient();
  await supabase.from("recurring_blackouts").insert({
    days_of_week: [...new Set(days)],
    start_minute: startMin,
    end_minute: endMin,
    reason,
    active: true,
  });
  revalidatePath("/admin/blackouts");
}

export async function deleteRecurringBlackout(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("recurring_blackouts").delete().eq("id", id);
  revalidatePath("/admin/blackouts");
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
  // Start time applies the weekday-daytime 2h deal ($60+GST) when it fits;
  // groups of 5+ add the flat surcharge ($20+GST 1h / $30+GST 2h+).
  const total = calcPriceCents(tier, durationHours, start) + groupSurchargeCents(durationHours, groupSize);

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

/* ------------------------------------------------------------------ *
 * Discount codes
 * ------------------------------------------------------------------ */

type EmailDiscountResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/**
 * Generate a single-use % discount code tied to a booking's customer + booking,
 * insert it, and email the customer a branded "come back for X% off" offer with
 * a self-applying booking link. Defaults: single use, 60-day expiry.
 */
export async function emailDiscountCode(
  bookingId: string,
  percent: number,
): Promise<EmailDiscountResult> {
  await assertAdmin();

  const pct = Math.round(Number(percent));
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    return { ok: false, error: "Enter a percentage between 1 and 100." };
  }

  const booking = await getFullBooking(bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (!booking.customer.email) {
    return { ok: false, error: "This customer has no email address." };
  }

  const supabase = createAdminClient();
  const code = await generateUniqueCode(supabase, pct);
  const expiresAt = new Date(Date.now() + DISCOUNT_EXPIRY_DAYS * 24 * 3600 * 1000);

  const { error: insertError } = await supabase.from("discount_codes").insert({
    code,
    percent: pct,
    status: "active",
    max_uses: 1,
    used_count: 0,
    expires_at: expiresAt.toISOString(),
    customer_id: booking.customer_id,
    booking_id: booking.id,
    note: `Sent from booking ${booking.friendly_id}`,
  });
  if (insertError) {
    console.error("[discounts] insert failed", insertError);
    return { ok: false, error: "Could not create the code. Try again." };
  }

  const result = await sendEmail({
    to: booking.customer.email,
    subject: `${pct}% off your next Unit 20 session`,
    react: createElement(DiscountOffer, {
      firstName: booking.customer.name.split(/\s+/)[0] || "there",
      percent: pct,
      code,
      expiryLabel: formatNZ(expiresAt.toISOString(), "EEE d MMM yyyy"),
      bookUrl: `${site.url}/studio/book?code=${encodeURIComponent(code)}`,
    }),
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/discounts");

  if (!result.ok) {
    // The code exists and is usable; only the email failed.
    return {
      ok: false,
      error: `Code ${code} created, but the email didn't send. You can share it manually.`,
    };
  }
  return { ok: true, code };
}

/** Admin: create a code by hand (auto-name if blank). Reusable campaign codes
 *  come from a high/blank max_uses. */
export async function createDiscountCode(formData: FormData) {
  await assertAdmin();
  const supabase = createAdminClient();

  const percent = Math.round(Number(formData.get("percent") ?? 0));
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return;

  const rawCode = String(formData.get("code") ?? "").trim();
  const code = rawCode ? normalizeCode(rawCode) : await generateUniqueCode(supabase, percent);
  if (!code) return;

  // Blank/0 max_uses = unlimited (reusable campaign code).
  const rawMax = String(formData.get("max_uses") ?? "").trim();
  const maxUses = rawMax === "" || Number(rawMax) === 0 ? null : Math.max(1, Math.round(Number(rawMax)));

  const rawExpiry = String(formData.get("expires_at") ?? "").trim();
  let expiresAt: string | null = null;
  if (rawExpiry) {
    const d = new Date(rawExpiry);
    if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
  }

  const note = String(formData.get("note") ?? "").trim() || null;

  const { error } = await supabase.from("discount_codes").insert({
    code,
    percent,
    status: "active",
    max_uses: maxUses,
    used_count: 0,
    expires_at: expiresAt,
    note,
  });
  if (error) console.error("[discounts] manual create failed", error);
  revalidatePath("/admin/discounts");
}

/** Admin: disable a code so it can no longer be redeemed. */
export async function disableDiscountCode(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("discount_codes").update({ status: "disabled" }).eq("id", id);
  revalidatePath("/admin/discounts");
}

/** Admin: re-enable a disabled code. */
export async function enableDiscountCode(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("discount_codes").update({ status: "active" }).eq("id", id);
  revalidatePath("/admin/discounts");
}

/** Admin: delete a code outright. Bookings that used it keep their net price
 *  (discount_code_id is set null by the FK, discount_amount_cents is unchanged). */
export async function deleteDiscountCode(id: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  // Detach from any bookings first so the FK doesn't block the delete.
  await supabase.from("bookings").update({ discount_code_id: null }).eq("discount_code_id", id);
  await supabase.from("discount_codes").delete().eq("id", id);
  revalidatePath("/admin/discounts");
}
