import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveLinkedCustomer } from "@/lib/customer-auth";
import { bankedHoursBalance, creditBankedHours } from "@/lib/banked-hours";
import { bookingInputSchema, normalizeNZPhone } from "@/lib/validation";
import {
  ROOM_OPENING_STATUSES,
  type DaySession,
  dayOpensAt,
  isBookableStart,
  noticeRefusal,
} from "@/lib/booking-window";
import { formatNZ, nzDateHourToUtc } from "@/lib/timezone";
import {
  bookingOption,
  calcBookingPriceCents,
  formatNZDPlusGst,
  isOptionOffered,
  weekdayDealApplies,
} from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricing-store";
import { sendBookingCreatedEmails } from "@/lib/notifications";
import { requestIdVerification } from "@/lib/id-verification";
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
  // Past times are checked here; the notice rule needs the day's other
  // sessions, so it waits until we have a Supabase client (below).
  // 409, not 422: the payload is fine, the *time* is no longer bookable, and
  // 409 is what sends the flow back to the time picker with a fresh slot list
  // instead of stranding them on the review step.
  if (start.getTime() <= Date.now()) {
    return NextResponse.json({ error: "That time has already passed — pick another." }, { status: 409 });
  }

  // The live price list (admin-editable; falls back to code defaults if the
  // settings row can't be read — a pricing outage must never stop a booking).
  const pricing = await getPricingSettings();

  // Resolve the booking option (legacy clients send only durationHours).
  const optionId = input.optionId ?? (input.durationHours === 1 ? "1h" : "2h");
  const option = bookingOption(pricing, optionId);
  if (input.durationHours !== option.durationHours) {
    return NextResponse.json(
      { error: "That duration doesn't match the selected option." },
      { status: 422 },
    );
  }
  // An option switched off in the admin panel while this flow was open. 409
  // rather than 422 for the same reason a taken slot is: the answer is to go
  // back and pick again from a fresh list, not to fix the form.
  if (!isOptionOffered(pricing, optionId)) {
    return NextResponse.json(
      { error: "That option isn't available any more — pick another." },
      { status: 409 },
    );
  }
  if (option.weekdayDaytimeOnly && !weekdayDealApplies(pricing, start, option.durationHours)) {
    return NextResponse.json(
      {
        error: `The ${pricing.weekdayDeal.label} rate only covers qualifying weekday sessions — pick a qualifying start time or the standard 2-hour option.`,
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

  // Minimum notice, re-checked against the server clock — the slot list this
  // came from may be an hour stale. Cheap because it only runs when the start
  // is inside the window at all: everything ≥ MIN_NOTICE_HOURS out skips the
  // query entirely. The day's other sessions decide whether the room is
  // already being opened, which is what lets a late start through.
  if (!isBookableStart(start, null)) {
    const nzDay = formatNZ(start, "yyyy-MM-dd");
    // Both ends from civil dates, so a DST day (23 or 25 hours long) still
    // bounds exactly one NZ day.
    const [dy, dm, dd] = nzDay.split("-").map(Number);
    const nextDay = new Date(Date.UTC(dy, dm - 1, dd + 1)).toISOString().slice(0, 10);
    const dayStartIso = nzDateHourToUtc(nzDay, 0).toISOString();
    const dayEndIso = nzDateHourToUtc(nextDay, 0).toISOString();
    const { data: sameDay } = await supabase
      .from("bookings")
      .select("start_time,status")
      .in("status", [...ROOM_OPENING_STATUSES])
      .gte("start_time", dayStartIso)
      .lt("start_time", dayEndIso);
    const refusal = noticeRefusal(start, dayOpensAt((sameDay as DaySession[]) ?? []));
    if (refusal) {
      return NextResponse.json({ error: refusal }, { status: 409 });
    }
  }

  // Who's booking? (Signed-in accounts get banked hours + booking linkage.)
  let authUser: User | null = null;
  try {
    const server = await createSupabaseServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();
    authUser = user;
  } catch {
    authUser = null;
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
  // Cap comes from the live settings, not the tier row — the row is a mirror
  // written on save, and the settings are what the booking flow was rendered
  // from.
  if (input.groupSize < 1 || input.groupSize > pricing.room.maxGroupSize) {
    return NextResponse.json(
      { error: `Group size must be between 1 and ${pricing.room.maxGroupSize}.` },
      { status: 422 },
    );
  }

  // Base rate for the chosen option (banked options are $0 base) + flat
  // surcharge for groups of 5+. For banked bookings the subtotal is just the
  // surcharge (payable in person); everything else is covered by prepaid hours.
  const { baseCents, surchargeCents, totalCents: subtotal } = calcBookingPriceCents({
    settings: pricing,
    optionId,
    start,
    groupSize: input.groupSize,
  });

  let customer: Customer;
  let discountId: string | null = null;
  let discountCents = 0;
  // Ledger row id for a banked booking — used to link it to the booking on
  // success, or to compensate (delete) if slot creation fails.
  let bankedLedgerId: string | null = null;

  if (option.usesBankedHours) {
    // ---- Banked-hours booking: prepaid, account-only, never a free slot ----
    if (!authUser) {
      return NextResponse.json(
        { error: "Sign in to your account to book with banked hours." },
        { status: 401 },
      );
    }
    const linked = await resolveLinkedCustomer(supabase, authUser);
    if (!linked) {
      return NextResponse.json(
        { error: "This account has no banked hours yet." },
        { status: 422 },
      );
    }
    // Refresh details from the form (name/phone/dob stay editable).
    const { data: updated } = await supabase
      .from("customers")
      .update({
        name: input.name,
        phone,
        dob: input.dob,
        marketing_opt_in: input.marketingOptIn || linked.marketing_opt_in,
      })
      .eq("id", linked.id)
      .select("*")
      .single();
    customer = (updated ?? linked) as Customer;

    // Debit BEFORE inserting the booking — the balance can never go negative
    // and we never create a $0 slot the customer didn't have hours for.
    const { data: ledgerId } = await supabase.rpc("debit_banked_hours", {
      p_customer_id: customer.id,
      p_hours: option.durationHours,
      p_booking_id: null,
      p_note: "online booking",
    });
    if (!ledgerId) {
      return NextResponse.json(
        { error: "Not enough banked hours left on your account." },
        { status: 409 },
      );
    }
    bankedLedgerId = ledgerId as string;
    // Discount codes never combine with banked hours.
  } else {
    // ---- Standard cash booking ----
    // Discount code (server is the source of truth). Re-validate the submitted
    // code; if valid, take the percent off the ex-GST subtotal. An invalid or
    // absent code simply books at full price — it never fails the booking. A
    // `standard_only` reward code is refused on the 10-hour pack (books at full
    // price). The atomic redemption happens only after the booking row exists.
    if (input.discountCode && input.discountCode.trim()) {
      const check = await validateDiscountCode(supabase, input.discountCode);
      if (check.valid && check.row) {
        if (check.row.standard_only && option.isPack) {
          // Reward codes apply to standard rates only — never the pack.
        } else {
          discountId = check.row.id;
          discountCents = discountAmountCents(subtotal, check.percent);
        }
      }
    }

    // find-or-create customer
    const email = input.email.toLowerCase();
    const { data: existing } = await supabase
      .from("customers")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      const prev = existing as Customer;
      const { data: updated } = await supabase
        .from("customers")
        .update({
          name: input.name,
          phone,
          dob: input.dob,
          marketing_opt_in: input.marketingOptIn || prev.marketing_opt_in,
          // Link the account if this signed-in user matches by email.
          ...(authUser && !prev.auth_user_id && authUser.email?.toLowerCase() === email
            ? { auth_user_id: authUser.id }
            : {}),
        })
        .eq("id", prev.id)
        .select("*")
        .single();
      customer = (updated ?? prev) as Customer;
    } else {
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          email,
          name: input.name,
          phone,
          dob: input.dob,
          marketing_opt_in: input.marketingOptIn,
          ...(authUser && authUser.email?.toLowerCase() === email
            ? { auth_user_id: authUser.id }
            : {}),
        })
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
  }

  const total = subtotal - discountCents;

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
    // Banked debit already happened — release it so nothing is lost.
    if (bankedLedgerId) {
      await supabase.from("hour_ledger").delete().eq("id", bankedLedgerId);
    }
    if (rpcError.message?.includes("SLOT_TAKEN")) {
      return NextResponse.json(
        { error: "That slot was just taken — please pick another time." },
        { status: 409 },
      );
    }
    // The booth's CDJs + DJM-A9 are out on a crewed All Ears job that day, so
    // the DB trigger refused the insert. Its message is written for customers.
    if (rpcError.hint === "GEAR_BLOCKED") {
      return NextResponse.json({ error: rpcError.message }, { status: 409 });
    }
    console.error("[bookings] create_booking_slot failed", rpcError);
    return NextResponse.json({ error: "Could not create the booking." }, { status: 500 });
  }

  const booking = bookingRow as Booking;

  // ---- Banked booking: link the ledger draw + record it on the booking ----
  if (option.usesBankedHours && bankedLedgerId) {
    await supabase
      .from("hour_ledger")
      .update({ booking_id: booking.id, note: `Session ${booking.friendly_id}` })
      .eq("id", bankedLedgerId);

    const remaining = await bankedHoursBalance(supabase, customer.id);
    // Fully-covered confirmed sessions are paid (triggers the door-code email);
    // anything with a cash surcharge, or still pending ID verification, stays
    // unpaid so the door code doesn't go out early.
    const payment_status =
      surchargeCents === 0 && status === "confirmed" ? "paid" : "unpaid";
    const noteLines = [
      `BANKED HOURS: ${option.durationHours}h drawn from prepaid balance — ${remaining}h remain.`,
    ];
    if (surchargeCents > 0) {
      noteLines.push(`Group surcharge ${formatNZDPlusGst(surchargeCents)} payable in person.`);
    }
    await supabase
      .from("bookings")
      .update({
        banked_hours_used: option.durationHours,
        payment_status,
        internal_note: noteLines.join("\n"),
      })
      .eq("id", booking.id);
    booking.banked_hours_used = option.durationHours;
    booking.payment_status = payment_status;
  }

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

  // ---- 10-hour pack: bank the hours + draw down this first session ----
  if (option.isPack) {
    const noteLines = [
      `${pricing.pack.packHours}-HOUR PACK (${formatNZDPlusGst(pricing.pack.totalCents)} prepaid block). ` +
        `This booking is the first ${option.durationHours}h — ` +
        `${pricing.pack.packHours - option.durationHours}h remain banked to the account.`,
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

    // Bank all 10 hours, then draw down the 2h scheduled now → 8h remain.
    await creditBankedHours(supabase, {
      customerId: customer.id,
      hours: pricing.pack.packHours,
      reason: "pack_purchase",
      bookingId: booking.id,
      note: `${pricing.pack.packHours}-hour pack ${booking.friendly_id}`,
    });
    await supabase.rpc("debit_banked_hours", {
      p_customer_id: customer.id,
      p_hours: option.durationHours,
      p_booking_id: booking.id,
      p_note: `First pack session ${booking.friendly_id}`,
    });
    await supabase
      .from("bookings")
      .update({ banked_hours_used: option.durationHours })
      .eq("id", booking.id);
    booking.banked_hours_used = option.durationHours;
  }

  // What the price was made of, for emails/admin.
  const rateNote = option.usesBankedHours
    ? `Banked hours — ${option.durationHours}h from your prepaid balance`
    : option.isPack
      ? `${pricing.pack.packHours}-hour pack — first ${option.durationHours}h booked`
      : optionId === "2h-daytime" ||
          (optionId === "2h" && baseCents !== pricing.rates.twoHourCents)
        ? pricing.weekdayDeal.label
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

  // An unverified customer gets their one-off ID upload link straight away, so
  // the check is already in motion by the time the admin looks at the booking.
  // `pending` is exactly "this customer isn't verified", and requestIdVerification
  // re-checks and never throws — a failure here costs a link, not a booking.
  if (pending) {
    const idRequest = await requestIdVerification(customer.id);
    if (idRequest.status === "failed") {
      console.error("[bookings] ID verification link not sent", {
        customerId: customer.id,
        reason: idRequest.reason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    friendlyId: booking.friendly_id,
    status: booking.status,
    totalCents: booking.total_price_cents,
  });
}
