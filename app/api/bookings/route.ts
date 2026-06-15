import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingInputSchema, normalizeNZPhone } from "@/lib/validation";
import { calcPriceCents } from "@/lib/pricing";
import { sendBookingCreatedEmails } from "@/lib/notifications";
import type { Booking, Customer, PricingTier } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again.", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;
  const phone = normalizeNZPhone(input.phone) ?? input.phone;

  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + input.durationHours * 3600 * 1000);
  if (start.getTime() <= Date.now()) {
    return NextResponse.json({ error: "That time has already passed — pick another." }, { status: 422 });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Bookings are temporarily unavailable." }, { status: 503 });
  }

  // tier + group-size validation
  const { data: tierRow } = await supabase
    .from("pricing_tiers")
    .select("*")
    .eq("slug", input.tierSlug)
    .maybeSingle();
  if (!tierRow) {
    return NextResponse.json({ error: "Unknown pricing tier." }, { status: 422 });
  }
  const tier = tierRow as PricingTier;
  if (input.groupSize < 1 || input.groupSize > tier.max_people) {
    return NextResponse.json(
      { error: `Group size must be between 1 and ${tier.max_people}. For larger groups, please get in touch.` },
      { status: 422 },
    );
  }

  const total = calcPriceCents(tier, input.durationHours);

  // find-or-create customer
  const email = input.email.toLowerCase();
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  let customer: Customer;
  if (existing) {
    const prev = existing as Customer;
    const { data: updated } = await supabase
      .from("customers")
      .update({
        name: input.name,
        phone,
        dob: input.dob,
        marketing_opt_in: input.marketingOptIn || prev.marketing_opt_in,
      })
      .eq("id", prev.id)
      .select("*")
      .single();
    customer = (updated ?? prev) as Customer;
  } else {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ email, name: input.name, phone, dob: input.dob, marketing_opt_in: input.marketingOptIn })
      .select("*")
      .single();
    if (error || !created) {
      // unique-email race: re-fetch
      const { data: refetch } = await supabase.from("customers").select("*").eq("email", email).maybeSingle();
      if (!refetch) {
        return NextResponse.json({ error: "Could not save your details." }, { status: 500 });
      }
      customer = refetch as Customer;
    } else {
      customer = created as Customer;
    }
  }

  const pending = !customer.id_verified;
  const status = pending ? "pending_verification" : "confirmed";

  // atomic: re-check overlap + generate friendly id + insert, in one txn
  const { data: bookingRow, error: rpcError } = await supabase.rpc("create_booking_slot", {
    p_customer_id: customer.id,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
    p_duration_hours: input.durationHours,
    p_pricing_tier_id: tier.id,
    p_group_size: input.groupSize,
    p_total_price_cents: total,
    p_is_peak: false,
    p_status: status,
    p_source: input.source ?? null,
    p_customer_note: input.customerNote ?? null,
  });

  if (rpcError) {
    if (rpcError.message?.includes("SLOT_TAKEN")) {
      return NextResponse.json(
        { error: "That slot was just taken — please pick another time." },
        { status: 409 },
      );
    }
    console.error("[bookings] create_booking_slot failed", rpcError);
    return NextResponse.json({ error: "Could not create the booking." }, { status: 500 });
  }

  const booking = bookingRow as Booking;

  // Emails must never block booking creation.
  try {
    await sendBookingCreatedEmails({ booking, customer, tier, pending });
  } catch (e) {
    console.error("[bookings] email dispatch failed (booking still created)", e);
  }

  return NextResponse.json({
    ok: true,
    friendlyId: booking.friendly_id,
    status: booking.status,
    totalCents: booking.total_price_cents,
  });
}
