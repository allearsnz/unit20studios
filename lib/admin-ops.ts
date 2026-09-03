import { createElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, icsAttachment } from "@/lib/email";
import { buildBookingIcs } from "@/lib/ics";
import { formatBookingWhen } from "@/lib/timezone";
import { formatNZDPlusGstIncl } from "@/lib/pricing";
import { creditBankedHours } from "@/lib/banked-hours";
import {
  ID_BUCKET,
  removeStoredDocuments,
  signedDocumentUrls,
} from "@/lib/id-verification";
import { site } from "@/lib/site";
import BookingConfirmed from "@/emails/BookingConfirmed";
import BookingReceivedNewCustomer from "@/emails/BookingReceivedNewCustomer";
import BookingCancelled from "@/emails/BookingCancelled";
import type { Booking, Customer, IdVerification, PricingTier } from "@/lib/types";

/**
 * THE ADMIN OPERATIONS THEMSELVES — with no opinion about who asked.
 *
 * These four used to live inside `app/admin/actions.ts`, each behind
 * `assertAdmin()`. That was right while the studio admin was the only caller.
 * It stopped being right when the crew app at crew.allears.nz gained a Studio
 * workspace: the crew side does its own reads and writes straight to Postgres
 * under RLS (crew `0042`/`0163`), but a short list of actions genuinely needs
 * the SERVICE ROLE and a server — approving an ID *deletes two files*, rotating
 * an upload link writes a hashed token to a table with no RLS policy at all,
 * and every email here is a React Email template rendered through Resend.
 *
 * So there are now two callers with two different ways of proving who they are:
 *
 *   * `app/admin/actions.ts`  — a cookie session whose email is ADMIN_EMAIL,
 *     plus `revalidatePath` for the screens the admin is looking at.
 *   * `app/api/admin/*`       — a crew member's Supabase access token, checked
 *     against `has_perm('studio.manage')` (see `lib/crew-auth.ts`).
 *
 * Authentication belongs to the caller; the work belongs here. Splitting it
 * this way is what stops the crew API becoming a SECOND implementation that
 * drifts — in particular one that sets `id_verified` without deleting the
 * images, which is the exact failure the ID pipeline exists to prevent.
 *
 * Nothing in this file calls `revalidatePath` or `redirect`: both are for the
 * admin's own browser, and neither means anything to an HTTP client in another
 * app. The server actions still do it, on the way out.
 */

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type FullBooking = Booking & { customer: Customer; pricing_tier: PricingTier };

export async function getFullBooking(id: string): Promise<FullBooking | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, customer:customers(*), pricing_tier:pricing_tiers(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as FullBooking | null) ?? null;
}

export function bookingEmailProps(b: FullBooking) {
  return {
    firstName: b.customer.name.split(/\s+/)[0] || "there",
    friendlyId: b.friendly_id,
    whenLabel: formatBookingWhen(b.start_time, b.end_time),
    durationHours: b.duration_hours,
    tierLabel: b.pricing_tier.label,
    groupSize: b.group_size,
    total: formatNZDPlusGstIncl(b.total_price_cents),
    manageUrl: `${site.url}/studio/book/confirmation?id=${b.friendly_id}`,
    // Prompt an account only if they haven't got one — `auth_user_id` is
    // stamped when a customers row is linked to a sign-in, so it stops asking
    // by itself once they sign up.
    signupUrl: b.customer.auth_user_id ? null : `${site.url}/account/signup`,
  };
}

// ---------------------------------------------------------------------------
// ID verification
// ---------------------------------------------------------------------------

export type IdDocumentsResult =
  | {
      status: "ok";
      front: string | null;
      back: string | null;
      uploadedAt: string | null;
      expiresInSeconds: number;
    }
  | { status: "customer_not_found" }
  | { status: "already_verified" }
  | { status: "nothing_uploaded" };

/** How long the signed URLs live. Five minutes is long enough to look at two
 *  photographs and short enough that a copied link is worthless by the time it
 *  reaches anywhere else. `signedDocumentUrls` mints them at this same TTL. */
export const ID_URL_TTL_SECONDS = 300;

/**
 * Both sides of a customer's ID as short-lived signed URLs.
 *
 * The `id-documents` bucket is private and RLS-denies everyone, so this is the
 * only read path that exists — which is why it is service-role-only and why the
 * result must never be cached. `already_verified` and `nothing_uploaded` are
 * separate answers on purpose: the first means the images were deleted because
 * the check is done, the second means they were never sent. Rendering both as
 * "no images" is how a screen ends up telling an operator to chase someone who
 * has already been approved.
 */
export async function idDocumentsForCustomer(customerId: string): Promise<IdDocumentsResult> {
  const supabase = createAdminClient();

  const { data: cust } = await supabase
    .from("customers")
    .select("id, id_verified")
    .eq("id", customerId)
    .maybeSingle();
  const customer = cust as Pick<Customer, "id" | "id_verified"> | null;
  if (!customer) return { status: "customer_not_found" };
  if (customer.id_verified) return { status: "already_verified" };

  const { data } = await supabase
    .from("id_verifications")
    .select("front_path, back_path, submitted_at")
    .eq("customer_id", customerId)
    .maybeSingle();
  const row = data as Pick<
    IdVerification,
    "front_path" | "back_path" | "submitted_at"
  > | null;

  if (!row || (!row.front_path && !row.back_path)) return { status: "nothing_uploaded" };

  const { front, back } = await signedDocumentUrls(supabase, row);
  return {
    status: "ok",
    front,
    back,
    uploadedAt: row.submitted_at,
    expiresInSeconds: ID_URL_TTL_SECONDS,
  };
}

export type VerifyCustomerResult =
  | { status: "verified"; alreadyVerified: boolean }
  | { status: "customer_not_found" };

/**
 * Approve a customer's ID — and delete both images while doing it.
 *
 * The deletion is not tidy-up, it is half of the action. The check is done, and
 * a folder of other people's licences is a liability rather than an asset;
 * `customers.id_verified_at` is the lasting record that it happened. This is
 * exactly why the crew app cannot do this with a plain `UPDATE customers` under
 * its RLS grant — that would set the flag and leave the scan in storage.
 */
export async function verifyCustomerId(customerId: string): Promise<VerifyCustomerResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("customers")
    .select("id, id_verified")
    .eq("id", customerId)
    .maybeSingle();
  const before = existing as Pick<Customer, "id" | "id_verified"> | null;
  if (!before) return { status: "customer_not_found" };

  await supabase
    .from("customers")
    .update({ id_verified: true, id_verified_at: new Date().toISOString() })
    .eq("id", customerId);

  const { data } = await supabase
    .from("id_verifications")
    .select("id, front_path, back_path")
    .eq("customer_id", customerId)
    .maybeSingle();
  const row = data as Pick<IdVerification, "id" | "front_path" | "back_path"> | null;
  if (row) {
    await removeStoredDocuments(supabase, row);
    await supabase
      .from("id_verifications")
      .update({ front_path: null, back_path: null, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  // Re-approving is harmless and worth reporting rather than refusing: two
  // people looking at the same customer from two apps is the normal case now.
  return { status: "verified", alreadyVerified: before.id_verified };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export type CancelBookingResult =
  | { status: "cancelled"; friendlyId: string; emailed: boolean; refundedHours: number }
  | { status: "already_cancelled"; friendlyId: string }
  | { status: "booking_not_found" };

/**
 * Cancel a booking and tell the customer.
 *
 * Cancelling on its own is a plain status write and the crew app does that
 * itself under RLS. What comes through here is the *email* — and the banked-
 * hours refund, which must happen exactly once. The `neq('cancelled')` guard is
 * what makes that true: only the first transition into `cancelled` returns a
 * row, so re-cancelling can neither double-refund nor re-email.
 *
 * `reason` is recorded on `internal_note`, NOT in the customer's email. An
 * operator's shorthand ("decks out Sat", "double booked") is a note to the
 * business; putting free text straight into a customer-facing template is how
 * that ends up in somebody's inbox. The email keeps its own settled wording.
 */
export async function cancelBookingWithEmail(
  id: string,
  reason?: string | null,
): Promise<CancelBookingResult> {
  const supabase = createAdminClient();

  const { data: transitioned } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .neq("status", "cancelled")
    .select("customer_id, friendly_id, banked_hours_used, internal_note")
    .maybeSingle();
  const t = transitioned as
    | {
        customer_id: string;
        friendly_id: string;
        banked_hours_used: number;
        internal_note: string | null;
      }
    | null;

  if (!t) {
    // Either there is no such booking, or it was already cancelled. Tell those
    // apart so the caller can answer "nothing to do" rather than "no such
    // thing" — they are different sentences to whoever pressed the button.
    const { data } = await supabase
      .from("bookings")
      .select("friendly_id")
      .eq("id", id)
      .maybeSingle();
    const row = data as Pick<Booking, "friendly_id"> | null;
    return row
      ? { status: "already_cancelled", friendlyId: row.friendly_id }
      : { status: "booking_not_found" };
  }

  let refundedHours = 0;
  if (t.banked_hours_used > 0) {
    await creditBankedHours(supabase, {
      customerId: t.customer_id,
      hours: t.banked_hours_used,
      reason: "session_refund",
      bookingId: id,
      note: `Cancelled booking ${t.friendly_id}`,
    });
    refundedHours = t.banked_hours_used;
  }

  const note = reason?.trim();
  if (note) {
    const stamp = `Cancelled: ${note}`;
    await supabase
      .from("bookings")
      .update({ internal_note: t.internal_note ? `${t.internal_note}\n${stamp}` : stamp })
      .eq("id", id);
  }

  const booking = await getFullBooking(id);
  let emailed = false;
  if (booking?.customer.email) {
    const sent = await sendEmail({
      to: booking.customer.email,
      subject: `Your booking ${booking.friendly_id} has been cancelled`,
      react: createElement(BookingCancelled, {
        firstName: booking.customer.name.split(/\s+/)[0] || "there",
        friendlyId: booking.friendly_id,
        whenLabel: formatBookingWhen(booking.start_time, booking.end_time),
        bookUrl: `${site.url}/studio/book`,
      }),
    });
    emailed = sent.ok;
  }

  return { status: "cancelled", friendlyId: t.friendly_id, emailed, refundedHours };
}

export type ResendConfirmationResult =
  | { status: "sent"; friendlyId: string; template: "confirmed" | "received" }
  | { status: "no_email"; friendlyId: string }
  | { status: "send_failed"; friendlyId: string; error?: string }
  | { status: "booking_not_found" };

/**
 * Re-send whichever confirmation the booking's status actually warrants.
 *
 * A `pending_verification` booking gets the "we've got your request" email —
 * the one that asks for ID — not the "you're booked" one. Sending the wrong one
 * here would tell an unverified customer they were confirmed, and nothing
 * downstream would back that up: no door code, no access instructions.
 */
export async function resendBookingConfirmation(
  id: string,
): Promise<ResendConfirmationResult> {
  const booking = await getFullBooking(id);
  if (!booking) return { status: "booking_not_found" };
  if (!booking.customer.email) {
    return { status: "no_email", friendlyId: booking.friendly_id };
  }

  const props = bookingEmailProps(booking);
  const confirmed = booking.status === "confirmed" || booking.status === "completed";

  const sent = confirmed
    ? await (async () => {
        const ics = buildBookingIcs(booking);
        return sendEmail({
          to: booking.customer.email,
          subject: `You're booked — ${booking.friendly_id}`,
          react: createElement(BookingConfirmed, props),
          attachments: ics
            ? [icsAttachment(`unit20-${booking.friendly_id}.ics`, ics)]
            : undefined,
        });
      })()
    : await sendEmail({
        to: booking.customer.email,
        subject: `We've got your booking request — ${booking.friendly_id}`,
        react: createElement(BookingReceivedNewCustomer, props),
      });

  if (!sent.ok) {
    return { status: "send_failed", friendlyId: booking.friendly_id, error: sent.error };
  }
  return {
    status: "sent",
    friendlyId: booking.friendly_id,
    template: confirmed ? "confirmed" : "received",
  };
}

// Re-exported so a caller needing the bucket name doesn't have to reach past
// this module into the ID pipeline's internals.
export { ID_BUCKET };
