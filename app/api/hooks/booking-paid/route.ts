import { type NextRequest, NextResponse } from "next/server";
import { runPaidAutomations } from "@/lib/booking-paid";
import type { Booking } from "@/lib/types";

/**
 * Supabase Database Webhook target — fires on `bookings` UPDATE.
 *
 * It covers every way payment_status can become 'paid' from OUTSIDE this app:
 * the Xero webhook (POST /api/webhooks/xero) and a manual "mark paid" in the
 * crew Studio tab. Marking paid in *this* app's admin runs the same chain
 * in-process (see setPaymentStatus) so the admin gets a result on screen rather
 * than trusting a webhook they cannot see; both paths land in
 * `runPaidAutomations`, which is safe to run twice.
 *
 * Configure the Supabase webhook to send:
 *   Authorization: Bearer <BOOKING_HOOK_SECRET>
 *
 * Payload shape (Supabase): { type, table, schema, record, old_record }.
 */
type DbWebhookPayload = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: Partial<Booking> | null;
  old_record?: Partial<Booking> | null;
};

export async function POST(req: NextRequest) {
  const secret = process.env.BOOKING_HOOK_SECRET;
  if (!secret) {
    console.error("[hooks/booking-paid] BOOKING_HOOK_SECRET not set — refusing");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: DbWebhookPayload;
  try {
    payload = (await req.json()) as DbWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const record = payload.record;
  const previous = payload.old_record;

  // Only act on a booking row that is now paid. Requiring a transition from
  // not-paid avoids re-sending on unrelated UPDATEs to an already-paid booking;
  // sendAccessInstructions() is also idempotent as a second line of defence.
  const isPaidNow = record?.payment_status === "paid";
  const wasPaidBefore = previous?.payment_status === "paid";
  if (!record?.id || !isPaidNow || wasPaidBefore) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Door code + access email both go out ON PAYMENT (not on approval).
  const result = await runPaidAutomations(record.id);

  // A transient send failure is worth a webhook redelivery, so answer 500 and
  // let Supabase retry — the failure is also recorded on the booking now, so
  // it stays visible in /admin whether or not a retry ever succeeds. The other
  // outcomes (no_email, not_found, already_sent) are not fixed by retrying.
  if (result.access.status === "send_failed") {
    return NextResponse.json({ error: "send_failed", result }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result });
}
