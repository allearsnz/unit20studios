import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFriendlyId } from "@/lib/booking-id";
import { rateLimit } from "@/lib/rate-limit";
import { requestIdVerification } from "@/lib/id-verification";

export const dynamic = "force-dynamic";

/**
 * "Send my ID link again" — from the confirmation page, for someone who came
 * back to it later.
 *
 * The on-the-spot form only works for the browser that made the booking (the
 * token is handed to it once and never put in a URL). Open that same page from
 * the email tomorrow and there is no token to be had, so the only thing left to
 * offer is a fresh link by email — which is what this does.
 *
 * Takes a booking reference and nothing else. That reference is guessable, and
 * it doesn't matter: the only thing it can make happen is the customer's own
 * link arriving at the customer's own address. Nothing is disclosed to the
 * caller, so the answer is deliberately shapeless — it never confirms whether a
 * reference exists.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`booking-id-link:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 });
  }

  const column = isFriendlyId(id) ? "friendly_id" : "id";
  const { data } = await supabase
    .from("bookings")
    .select("customer_id,status")
    .eq(column, id)
    .maybeSingle();
  const booking = data as { customer_id: string; status: string } | null;

  // Nothing to chase for a booking that's already been dealt with.
  if (!booking || booking.status !== "pending_verification") {
    return NextResponse.json({ ok: true });
  }

  const result = await requestIdVerification(booking.customer_id);
  if (result.status === "failed") {
    console.error("[bookings/id-link] resend failed", { reason: result.reason });
    return NextResponse.json(
      { error: "We couldn't send that just now — email studio@unit20.nz and we'll sort it." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
