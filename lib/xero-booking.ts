import { createAdminClient } from "./supabase/admin";
import {
  createBookingInvoice,
  emailInvoice,
  findOrCreateContact,
  getAccessToken,
  getOnlineInvoiceUrl,
  type InvoiceBooking,
} from "./xero";
import { formatBookingWhen } from "./timezone";
import type { Customer } from "./types";

export type InvoiceBookingResult =
  | { status: "invoiced"; invoiceId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Raise a Xero invoice for a booking and have Xero email the customer the
 * pay-now link. THIS TOUCHES REAL MONEY but is entirely BEST-EFFORT: it never
 * throws, so it can never break the approve/pay flows that call it.
 *
 * Exactly-once via an atomic DB claim (mirrors the `access_sent_at` pattern):
 * flips `invoice_status` 'not_invoiced' → 'creating'; the loser no-ops. On any
 * Xero failure BEFORE the invoice exists, the claim is rolled back to
 * 'not_invoiced' so a later retry can try again. Once the invoice exists it is
 * persisted regardless of whether fetching the URL / emailing succeeds (the
 * admin can resend), and the claim advances to 'authorised'.
 *
 * The Xero `Idempotency-Key` (booking:<id>:invoice) is a second line of defence
 * against a duplicate create if a retry slips past the DB claim.
 */
export async function invoiceBooking(bookingId: string): Promise<InvoiceBookingResult> {
  try {
    if (!process.env.XERO_CLIENT_ID || !process.env.XERO_ACCOUNT_CODE) {
      return { status: "skipped", reason: "xero_not_configured" };
    }

    const supabase = createAdminClient();

    const { data } = await supabase
      .from("bookings")
      .select(
        "id, friendly_id, duration_hours, group_size, total_price_cents, discount_amount_cents, start_time, end_time, invoice_status, customer:customers(*)",
      )
      .eq("id", bookingId)
      .maybeSingle();

    const booking = data as
      | (InvoiceBooking & { invoice_status: string | null; customer: Customer | null })
      | null;
    if (!booking) return { status: "skipped", reason: "booking_not_found" };
    if (!booking.customer?.email) return { status: "skipped", reason: "no_customer_email" };
    // Nothing to invoice on a fully banked-hours ($0) session.
    if (booking.total_price_cents === 0) return { status: "skipped", reason: "zero_total" };
    if (booking.invoice_status && booking.invoice_status !== "not_invoiced") {
      return { status: "skipped", reason: `already_${booking.invoice_status}` };
    }

    // Atomically claim: only one caller flips not_invoiced → creating.
    const { data: claimed } = await supabase
      .from("bookings")
      .update({ invoice_status: "creating" })
      .eq("id", bookingId)
      .eq("invoice_status", "not_invoiced")
      .select("id")
      .maybeSingle();
    if (!claimed) return { status: "skipped", reason: "claim_lost" };

    const rollback = async () => {
      await supabase
        .from("bookings")
        .update({ invoice_status: "not_invoiced" })
        .eq("id", bookingId)
        .eq("invoice_status", "creating");
    };

    const whenLabel = formatBookingWhen(booking.start_time, booking.end_time ?? booking.start_time);

    // Contact + invoice — a failure here means no invoice exists; roll back.
    let invoiceId: string;
    let token: string;
    try {
      token = await getAccessToken();
      const contactId = await findOrCreateContact(
        { name: booking.customer.name, email: booking.customer.email, phone: booking.customer.phone },
        token,
      );
      const invoice = await createBookingInvoice({ contactId, booking, whenLabel }, token);
      invoiceId = invoice.InvoiceID;
    } catch (e) {
      console.error(`[xero-booking] invoice create failed for ${bookingId}`, e);
      await rollback();
      return { status: "failed", error: e instanceof Error ? e.message : "create_failed" };
    }

    // Invoice exists — persist even if the URL fetch / email send fail.
    let onlineUrl: string | null = null;
    try {
      onlineUrl = await getOnlineInvoiceUrl(invoiceId, token);
    } catch (e) {
      console.error(`[xero-booking] online-invoice URL fetch failed for ${bookingId}`, e);
    }

    await supabase
      .from("bookings")
      .update({
        xero_invoice_id: invoiceId,
        online_invoice_url: onlineUrl,
        invoiced_at: new Date().toISOString(),
        invoice_status: "authorised",
      })
      .eq("id", bookingId);

    // Xero emails the invoice (pay-now link). Best-effort — admin can resend.
    try {
      await emailInvoice(invoiceId, token);
    } catch (e) {
      console.error(`[xero-booking] Xero invoice email failed for ${bookingId}`, e);
    }

    return { status: "invoiced", invoiceId };
  } catch (e) {
    // Absolute backstop — invoiceBooking must never throw to its caller.
    console.error(`[xero-booking] unexpected failure for ${bookingId}`, e);
    return { status: "failed", error: e instanceof Error ? e.message : "unexpected" };
  }
}
