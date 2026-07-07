import { type NextRequest, NextResponse } from "next/server";
import { sendAccessInstructions } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "@/lib/types";

/**
 * Mint + email the studio door code the moment payment lands. The crew-side DB
 * trigger (crew migration 0050) already INSERTs a *pending* studio_door_codes
 * row on payment_status → paid; this kicks the `issue-studio-door-code` edge
 * function to mint it against TTLock and email the customer their code now,
 * rather than waiting for the per-minute cron. Best-effort: never throws, so it
 * can't break the access-instructions send or the webhook that triggered us.
 */
async function issuePendingDoorCode(): Promise<void> {
  try {
    const supabase = createAdminClient();
    // Service-role JWT satisfies the function's verify_jwt; process_pending
    // mints every pending row (including the one just enqueued for this booking).
    await supabase.functions.invoke("issue-studio-door-code", {
      body: { process_pending: true },
    });
  } catch (e) {
    console.error("[hooks/booking-paid] door-code mint failed", e);
  }
}

/**
 * Supabase Database Webhook target — fires on `bookings` UPDATE.
 *
 * This is the single trigger for the post-payment access-instructions email, so
 * it works no matter *how* payment_status became 'paid': the Xero webhook
 * (POST /api/webhooks/xero) or a manual "mark paid" in the crew Studio tab.
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

  // Door code goes out ON PAYMENT (not on approval): mint the pending code now.
  // Best-effort and independent of the access email.
  await issuePendingDoorCode();

  try {
    const result = await sendAccessInstructions(record.id);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[hooks/booking-paid] send failed", e);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}
