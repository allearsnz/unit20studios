"use server";

import { createElement } from "react";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail, icsAttachment } from "@/lib/email";
import { buildBookingIcs } from "@/lib/ics";
import { formatBookingWhen, nzWallToUtc } from "@/lib/timezone";
import { calcPriceCents, formatNZDPlusGstIncl, groupSurchargeCents } from "@/lib/pricing";
import {
  PRICING_CACHE_TAG,
  getPricingSettings,
  writePricingSettings,
} from "@/lib/pricing-store";
import {
  DEFAULT_PRICING_SETTINGS,
  pricingSettingsProblem,
  pricingSettingsSchema,
} from "@/lib/pricing-settings";
import { normalizeNZPhone } from "@/lib/validation";
import { invoiceBooking } from "@/lib/xero-booking";
import {
  issuePendingDoorCodes,
  runPaidAutomations,
  type PaidSkipReason,
} from "@/lib/booking-paid";
import { sendAccessInstructions, type AccessSendResult } from "@/lib/notifications";
import { type RequestResult, requestIdVerification } from "@/lib/id-verification";
// The operations themselves. This file is the ADMIN's way in to them — the
// cookie session, the ADMIN_EMAIL check and the cache revalidation. The crew
// app reaches the same functions through `app/api/admin/*` with a crew token.
import {
  bookingEmailProps as emailProps,
  cancelBookingWithEmail,
  getFullBooking,
  resendBookingConfirmation,
  verifyCustomerId,
} from "@/lib/admin-ops";
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
import DiscountOffer from "@/emails/DiscountOffer";
import type {
  Booking,
  BookingStatus,
  Customer,
  PaymentStatus,
  PricingTier,
} from "@/lib/types";

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

/**
 * What marking a booking paid actually did, handed straight back to the button
 * that did it.
 *
 * `sent` is the only outcome that means the customer can get in. Everything
 * else is a sentence the admin needs to read *now* — not something to discover
 * three days later when someone is standing outside a locked roller door.
 */
export type PaymentUpdateResult = {
  /** True when this call is what flipped the booking to paid. */
  triggered: boolean;
  /**
   * Set when the payment deliberately sent nothing — a session that has already
   * finished, or a cancelled booking. Marking those paid is bookkeeping; the
   * other three fields are then absent because nothing was attempted.
   */
  skipped?: PaidSkipReason;
  access?: AccessSendResult["status"];
  accessError?: string;
  doorCodeQueued?: boolean;
};

export async function setPaymentStatus(
  id: string,
  payment_status: PaymentStatus,
): Promise<PaymentUpdateResult> {
  await assertAdmin();
  const supabase = createAdminClient();

  // Claim the transition into 'paid' the same way status changes are claimed:
  // only the call that actually moves the row runs the automations, so a
  // double-click can't send twice and re-selecting 'paid' on an already-paid
  // booking is a no-op rather than a second round of emails.
  if (payment_status === "paid") {
    const { data: transitioned } = await supabase
      .from("bookings")
      .update({ payment_status, paid_at: new Date().toISOString() })
      .eq("id", id)
      .neq("payment_status", "paid")
      .select("id")
      .maybeSingle();

    revalidatePath(`/admin/bookings/${id}`);
    revalidatePath("/admin");
    if (!transitioned) return { triggered: false };

    // PAYMENT IS THE TRIGGER FOR THE CUSTOMER'S WAY IN. Historically this
    // happened only via a Supabase Database Webhook → /api/hooks/booking-paid,
    // configured in the Supabase dashboard and invisible from here: if it was
    // missing or its secret had drifted, this click sent nothing and said
    // nothing. Running the same chain in-process means the admin gets an answer
    // on screen. The webhook stays — it still covers Xero and the crew app —
    // and running both is safe (the send is claimed atomically).
    const result = await runPaidAutomations(id);
    revalidatePath(`/admin/bookings/${id}`);
    if (result.skipped) return { triggered: true, skipped: result.skipped };
    return {
      triggered: true,
      access: result.access?.status,
      accessError:
        result.access && "error" in result.access ? result.access.error : undefined,
      doorCodeQueued: result.doorCodeKicked,
    };
  }

  await supabase.from("bookings").update({ payment_status }).eq("id", id);
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
  return { triggered: false };
}

/**
 * Unstick the access-instructions email. Deliberately NOT a "resend": the
 * sender no-ops when `access_sent_at` is set, so this only ever fires for a
 * booking where the email genuinely never went. Resending a mail the customer
 * already has is a different (and rarer) job, and conflating the two would make
 * the Automation tab's "sent" row untrustworthy.
 */
export async function retryAccessEmail(id: string): Promise<AccessSendResult> {
  await assertAdmin();
  const result = await sendAccessInstructions(id);
  revalidatePath(`/admin/bookings/${id}`);
  return result;
}

/**
 * Poke the crew-side minter for a door code that is queued but not yet minted.
 * This is the same call the paid hook makes, not a new path — and it is the
 * only one available to this app (per-booking re-issue needs a crew JWT holding
 * `doorcodes.manage`, which lives in the crew app's Studio → Door codes tab).
 */
export async function retryDoorCode(id: string): Promise<{ ok: boolean }> {
  await assertAdmin();
  const ok = await issuePendingDoorCodes();
  revalidatePath(`/admin/bookings/${id}`);
  return { ok };
}

export async function saveInternalNote(id: string, note: string) {
  await assertAdmin();
  const supabase = createAdminClient();
  await supabase.from("bookings").update({ internal_note: note }).eq("id", id);
  revalidatePath(`/admin/bookings/${id}`);
}

/**
 * Approve a customer's ID. Verification is permanent — every later booking of
 * theirs confirms straight away.
 *
 * The uploaded licence/passport images are deleted at the same time: the check
 * they existed for is done, and a folder of other people's ID scans is a
 * liability, not an asset. `id_verified_at` is the record that it happened.
 */
export async function verifyCustomer(customerId: string) {
  await assertAdmin();
  await verifyCustomerId(customerId);

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
  // The approve button also lives in the customer card on a BOOKING page, and
  // that page's ID section and automation checklist both read this. Revalidating
  // the route pattern covers whichever booking the admin is looking at — without
  // it, approving from a booking page updated nothing on screen.
  revalidatePath("/admin/bookings/[id]", "page");
}

/**
 * Send (or re-send) the ID upload link. Rotates the token, so the previous
 * link stops working — use it for customers who booked before this existed, or
 * who lost the email.
 *
 * Forced, unlike everything automatic: pressing this over a licence that is
 * already uploaded and waiting means "that one's no good, send me another",
 * which is a real thing an operator needs to be able to say. The scan itself
 * survives until the replacement lands (or until you approve), so a misclick
 * costs an email rather than the evidence.
 */
export async function resendIdVerification(customerId: string): Promise<RequestResult> {
  await assertAdmin();
  const result = await requestIdVerification(customerId, { force: true });
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  // Same reason as verifyCustomer: this button is on the booking page too, and
  // the "ID upload link emailed" row there is derived from what it writes.
  revalidatePath("/admin/bookings/[id]", "page");
  return result;
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
  // Refunds any banked hours the booking drew and emails the customer — see
  // lib/admin-ops.ts. Only the first transition into 'cancelled' does either,
  // so a double-click can't double-refund.
  await cancelBookingWithEmail(id);
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin");
}

export async function resendConfirmation(id: string) {
  await assertAdmin();
  await resendBookingConfirmation(id);
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
  // Prices come from the live settings (/admin/pricing), not the tier row: the
  // start time applies the weekday-daytime 2h deal when it fits, and a group
  // over the threshold adds the flat surcharge.
  const pricing = await getPricingSettings();
  const total =
    calcPriceCents(pricing, durationHours, start) +
    groupSurchargeCents(pricing, durationHours, groupSize);

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
    // Stamp paid_at here too — the Automation tab reads it as "when the money
    // landed", and a walk-in keyed at the desk is exactly the case where "no
    // timestamp" would otherwise look like a fault.
    await supabase
      .from("bookings")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", booking.id);
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
        signupUrl: customer.auth_user_id ? null : `${site.url}/account/signup`,
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

/**
 * Sign the admin out, server-side.
 *
 * This used to be a client component calling `supabase.auth.signOut()` in the
 * browser — which meant importing `@supabase/supabase-js` into the admin client
 * bundle. The button lives in `AdminShell`, i.e. the layout, so that import put
 * ~61KB gzipped of auth SDK on the hydration path of EVERY admin page, to run
 * one function on one click. As a server action the button needs no JavaScript
 * at all and the SDK leaves the bundle.
 *
 * No `assertAdmin()` guard: signing out is not a privileged operation, and a
 * request that isn't signed in has nothing to sign out of.
 */
export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/* -------------------------------------------------------------------------
 * Pricing
 *
 * The price list is one JSON row (`studio_settings.pricing`); this is the only
 * thing that writes it. Two rules worth keeping:
 *   - Money is typed in DOLLARS ex-GST and stored in CENTS. The conversion
 *     happens here, once, so no other layer has to think about it.
 *   - A save invalidates both the tagged data cache (the marketing pages read
 *     prices through it) and the prerendered pages themselves. Miss the second
 *     and the landing page keeps serving last week's rate from static HTML.
 * ---------------------------------------------------------------------- */

/** Dollars from a form field → cents, ex-GST. Blank/nonsense → `fallback`. */
function dollarsToCents(form: FormData, name: string, fallback: number): number {
  const raw = String(form.get(name) ?? "").trim().replace(/[$,\s]/g, "");
  if (!raw) return fallback;
  const dollars = Number(raw);
  if (!Number.isFinite(dollars) || dollars < 0) return fallback;
  return Math.round(dollars * 100);
}

function intField(form: FormData, name: string, fallback: number): number {
  const raw = String(form.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function textField(form: FormData, name: string, fallback: string): string {
  const raw = String(form.get(name) ?? "").trim();
  return raw || fallback;
}

function checkbox(form: FormData, name: string): boolean {
  return form.get(name) != null;
}

/** Everything a price change has to touch: the data cache and the static HTML. */
async function revalidatePricing() {
  // updateTag (not revalidateTag): this runs inside a server action, so the
  // admin — and the page they're about to look at — must read their own write,
  // not a stale-while-revalidate copy of last week's rate.
  updateTag(PRICING_CACHE_TAG);
  for (const path of ["/", "/studio/pricing", "/studio/book", "/admin/pricing"]) {
    revalidatePath(path);
  }
}

export async function savePricing(formData: FormData) {
  const admin = await requireAdmin();

  const draft = {
    room: {
      label: textField(formData, "room_label", DEFAULT_PRICING_SETTINGS.room.label),
      maxGroupSize: intField(formData, "room_max_group", DEFAULT_PRICING_SETTINGS.room.maxGroupSize),
    },
    rates: {
      oneHourCents: dollarsToCents(formData, "rate_1h", DEFAULT_PRICING_SETTINGS.rates.oneHourCents),
      twoHourCents: dollarsToCents(formData, "rate_2h", DEFAULT_PRICING_SETTINGS.rates.twoHourCents),
    },
    weekdayDeal: {
      enabled: checkbox(formData, "deal_enabled"),
      windowStartHour: intField(formData, "deal_start", 10),
      windowEndHour: intField(formData, "deal_end", 16),
      twoHourPriceCents: dollarsToCents(
        formData,
        "deal_price",
        DEFAULT_PRICING_SETTINGS.weekdayDeal.twoHourPriceCents,
      ),
      label: textField(formData, "deal_label", DEFAULT_PRICING_SETTINGS.weekdayDeal.label),
      shortNote: String(formData.get("deal_short_note") ?? "").trim(),
    },
    pack: {
      enabled: checkbox(formData, "pack_enabled"),
      packHours: intField(formData, "pack_hours", DEFAULT_PRICING_SETTINGS.pack.packHours),
      firstSessionHours: intField(
        formData,
        "pack_first_hours",
        DEFAULT_PRICING_SETTINGS.pack.firstSessionHours,
      ),
      totalCents: dollarsToCents(formData, "pack_total", DEFAULT_PRICING_SETTINGS.pack.totalCents),
    },
    groupSurcharge: {
      threshold: intField(
        formData,
        "surcharge_threshold",
        DEFAULT_PRICING_SETTINGS.groupSurcharge.threshold,
      ),
      oneHourCents: dollarsToCents(
        formData,
        "surcharge_1h",
        DEFAULT_PRICING_SETTINGS.groupSurcharge.oneHourCents,
      ),
      twoHourCents: dollarsToCents(
        formData,
        "surcharge_2h",
        DEFAULT_PRICING_SETTINGS.groupSurcharge.twoHourCents,
      ),
    },
    options: Object.fromEntries(
      (["1h", "2h", "2h-daytime", "pack10"] as const).map((id) => [
        id,
        {
          enabled: checkbox(formData, `opt_${id}_enabled`),
          label: textField(
            formData,
            `opt_${id}_label`,
            DEFAULT_PRICING_SETTINGS.options[id].label,
          ),
          note: String(formData.get(`opt_${id}_note`) ?? "").trim(),
        },
      ]),
    ),
  };

  const parsed = pricingSettingsSchema.safeParse(draft);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return pricingError(`${issue.path.join(".")}: ${issue.message}`);
  }
  const problem = pricingSettingsProblem(parsed.data);
  if (problem) return pricingError(problem);

  const result = await writePricingSettings(parsed.data, admin.email);
  if (!result.ok) return pricingError(result.error ?? "Could not save.");

  await revalidatePricing();
  redirect(
    result.mirrorError
      ? `/admin/pricing?saved=1&warn=${encodeURIComponent(`Saved, but the pricing_tiers mirror didn't update: ${result.mirrorError}`)}`
      : "/admin/pricing?saved=1",
  );
}

/** Put every knob back to the code defaults (flat $50+GST an hour). */
export async function resetPricing() {
  const admin = await requireAdmin();
  const result = await writePricingSettings(DEFAULT_PRICING_SETTINGS, admin.email);
  if (!result.ok) return pricingError(result.error ?? "Could not reset.");
  await revalidatePricing();
  redirect("/admin/pricing?saved=1");
}

function pricingError(message: string): never {
  redirect(`/admin/pricing?error=${encodeURIComponent(message)}`);
}
