import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchXeroInvoice,
  isInvoiceFullyPaid,
  verifyXeroSignature,
  type XeroWebhookPayload,
} from "@/lib/xero";

/**
 * Xero webhook receiver — the automatic "they paid" trigger.
 *
 * Flow:
 *  1. Verify the x-xero-signature HMAC over the RAW body. A bad/missing
 *     signature returns 401 — this is also exactly what Xero's "intent to
 *     receive" handshake tests (it sends one good and one bad signature and
 *     expects 200 then 401).
 *  2. For each INVOICE event, fetch the invoice, confirm it's fully PAID, and
 *     read its Reference — which Will sets to the booking friendly_id when he
 *     raises the invoice (e.g. U20-2026-0042).
 *  3. Set that booking's payment_status = 'paid' (idempotent — skip if already).
 *
 * Setting payment_status to 'paid' is picked up by the bookings Database Webhook
 * (POST /api/hooks/booking-paid), which sends the access-instructions email.
 * We do NOT send any email from here.
 *
 * NOTE: This route MUST read the raw body for signature verification, so it uses
 * req.text() and never req.json() before verifying.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-xero-signature");

  if (!verifyXeroSignature(raw, signature)) {
    // Also the correct response for the "intent to receive" bad-signature probe.
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Signature is valid. Empty-events payloads (the intent-to-receive probe) just
  // need a 200.
  let payload: XeroWebhookPayload;
  try {
    payload = JSON.parse(raw) as XeroWebhookPayload;
  } catch {
    return new NextResponse("OK", { status: 200 });
  }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const invoiceEvents = events.filter((e) => e.eventCategory === "INVOICE");
  if (invoiceEvents.length === 0) {
    return new NextResponse("OK", { status: 200 });
  }

  const supabase = createAdminClient();

  for (const event of invoiceEvents) {
    try {
      const invoice = await fetchXeroInvoice(event.resourceId);
      if (!invoice) continue;

      // Only sales invoices that are fully paid mark a booking paid.
      if (invoice.Type && invoice.Type !== "ACCREC") continue;
      if (!isInvoiceFullyPaid(invoice)) continue;

      const reference = invoice.Reference?.trim();
      if (!reference) {
        console.warn(`[webhooks/xero] paid invoice ${invoice.InvoiceID} has no Reference`);
        continue;
      }

      // Match by booking friendly_id (the invoice Reference). Only flip unpaid
      // bookings so this is idempotent across webhook redeliveries.
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, payment_status")
        .eq("friendly_id", reference)
        .maybeSingle();

      if (!booking) {
        console.warn(`[webhooks/xero] no booking for Reference "${reference}" (invoice ${invoice.InvoiceID})`);
        continue;
      }
      if (booking.payment_status === "paid") continue;

      const { error } = await supabase
        .from("bookings")
        .update({ payment_status: "paid" })
        .eq("id", booking.id)
        .neq("payment_status", "paid");
      if (error) {
        console.error(`[webhooks/xero] failed to mark ${reference} paid`, error);
      }
    } catch (e) {
      // Never fail the whole webhook for one event — Xero would retry the batch.
      console.error(`[webhooks/xero] event ${event.resourceId} failed`, e);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
