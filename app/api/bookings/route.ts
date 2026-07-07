import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingInputSchema, normalizeNZPhone } from "@/lib/validation";
import {
  BULK_PACK,
  FLAT_LIMITS,
  bookingOption,
  calcBookingPriceCents,
  formatNZDPlusGst,
  isWeekdayDaytime,
} from "@/lib/pricing";
import { sendBookingCreatedEmails } from "@/lib/notifications";
import { discountAmountCents, validateDiscountCode } from "@/lib/discounts";
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

  // Resolve the booking option (legacy clients send only durationHours).
  const optionId = input.optionId ?? (input.durationHours === 1 ? "1h" : "2h");
  const option = bookingOption(optionId);
  if (input.durationHours !== option.durationHours) {
    return NextResponse.json(
      { error: "That duration doesn't match the selected option." },
      { status: 422 },
    );
  }
  if (option.weekdayDaytimeOnly && !isWeekdayDaytime(start, option.durationHours)) {
    return NextResponse.json(
      {
        error:
          "The weekday-daytime rate only covers Mon–Fri sessions inside 10am–4pm — pick a qualifying start time or the standard 2-hour option.",
      },
      { status: 422 },
    );
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
  // Cap comes from code (FLAT_LIMITS), not the DB row, so it can't drift.
  if (input.groupSize < 1 || input.groupSize > FLAT_LIMITS.maxGroupSize) {
    return NextResponse.json(
      { error: `Group size must be between 1 and ${FLAT_LIMITS.maxGroupSize}.` },
      { status: 422 },
    );
  }

  // Base rate for the chosen option (the start time applies the
  // weekday-daytime 2h deal where it fits) + flat surcharge for groups of 5+.
  const { baseCents, surchargeCents, totalCents: subtotal } = calcBookingPriceCents({
    tier,
    optionId,
    start,
    groupSize: input.groupSize,
  });

  // Discount code (server is the source of truth). Re-validate the submitted
  // code; if valid, take the percent off the ex-GST subtotal. An invalid/absent
  // code simply books at full price — it never fails the booking. The atomic
  // redemption (below) happens only after the booking row exists.
  let discountId: string | null = null;
  let discountCents = 0;
  if (input.discountCode && input.discountCode.trim()) {
    const check = await validateDiscountCode(supabase, input.discountCode);
    if (check.valid && check.row) {
      discountId = check.row.id;
      discountCents = discountAmountCents(subtotal, check.percent);
    }
  }
  const total = subtotal - discountCents;

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

  // Redeem the discount (if one was applied). The booking already exists at the
  // NET price, so redemption is a separate atomic step: `redeem_discount_code`
  // claims one use only if the code is still redeemable, expiring it at its cap.
  // If a concurrent booking grabbed the last use between validate and here, the
  // claim fails and we revert this booking to full price so nothing is given
  // away for free.
  if (discountId) {
    const { data: redeemed, error: redeemError } = await supabase.rpc("redeem_discount_code", {
      p_id: discountId,
    });
    if (!redeemError && redeemed === true) {
      await supabase
        .from("bookings")
        .update({ discount_code_id: discountId, discount_amount_cents: discountCents })
        .eq("id", booking.id);
      booking.discount_code_id = discountId;
      booking.discount_amount_cents = discountCents;
    } else {
      // Lost the race (or RPC failed) — charge full price.
      await supabase
        .from("bookings")
        .update({ total_price_cents: subtotal, discount_amount_cents: 0 })
        .eq("id", booking.id);
      booking.total_price_cents = subtotal;
      discountCents = 0;
      discountId = null;
    }
  }

  // Flag pack bookings for admin: the scheduled slot is only the first 2 hours
  // of the prepaid 10-hour block.
  if (option.isPack) {
    const noteLines = [
      `10-HOUR PACK (${formatNZDPlusGst(BULK_PACK.totalCents)} prepaid block). ` +
        `This booking is the first ${option.durationHours}h — ` +
        `${BULK_PACK.packHours - option.durationHours}h remain to arrange with the customer.`,
    ];
    if (surchargeCents > 0) {
      noteLines.push(
        `Group of ${input.groupSize}: +${formatNZDPlusGst(surchargeCents)} surcharge included in the total.`,
      );
    }
    const { error: noteError } = await supabase
      .from("bookings")
      .update({ internal_note: noteLines.join("\n") })
      .eq("id", booking.id);
    if (noteError) {
      console.error("[bookings] failed to stamp pack internal_note", noteError);
    }
  }

  // What the price was made of, for emails/admin.
  const rateNote = option.isPack
    ? `10-hour pack — first ${option.durationHours}h booked`
    : optionId === "2h-daytime" || (optionId === "2h" && baseCents !== tier.peak_2h_price_cents)
      ? "Weekday daytime (Mon–Fri, 10am–4pm)"
      : null;

  // Emails must never block booking creation.
  try {
    await sendBookingCreatedEmails({
      booking,
      customer,
      tier,
      pending,
      rateNote,
      surchargeCents,
      isPack: option.isPack,
    });
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
