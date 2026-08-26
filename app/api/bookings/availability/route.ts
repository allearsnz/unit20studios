import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nzDateHourToUtc } from "@/lib/timezone";
import { weekdayDealApplies } from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricing-store";
import { dayOpensAt, isBookableStart } from "@/lib/booking-window";

export const dynamic = "force-dynamic";

const OPEN_HOUR = 10; // studio opens 10:00
const CLOSE_HOUR = 24; // slots start 10:00 … 23:00
const BUFFER_MS = 15 * 60 * 1000;

type Span = { start_time: string; end_time: string; status?: string | null };

/** Sessions that hold a slot. `completed` is fetched too — it's how we know the
 *  room was opened this morning — but it never blocks, because a completed
 *  session is behind us. */
const HOLDS_SLOT = new Set(["pending_verification", "confirmed"]);

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const dayStart = nzDateHourToUtc(date, 0).getTime();
  const dayEndIso = new Date(dayStart + 24 * 3600 * 1000).toISOString();
  const dayStartIso = new Date(dayStart).toISOString();
  // Nothing inside the notice window is offered — a start that's an hour away
  // on a cold day is greyed out exactly like a taken one. `POST /api/bookings`
  // re-checks against its own clock, so a page left open doesn't get through.
  const now = Date.now();

  type RecurRule = { days_of_week: number[]; start_minute: number; end_minute: number };

  let bookings: Span[] = [];
  let blackouts: Span[] = [];
  let recurring: RecurRule[] = [];
  // True when the booth's DJ gear is out on a crewed All Ears job that day.
  let gearBlocked = false;
  try {
    const supabase = createAdminClient();
    const [b, bl] = await Promise.all([
      supabase
        .from("bookings")
        .select("start_time,end_time,status")
        .in("status", ["pending_verification", "confirmed", "completed"])
        .lt("start_time", dayEndIso)
        .gt("end_time", dayStartIso),
      supabase
        .from("blackout_periods")
        .select("start_time,end_time")
        .lt("start_time", dayEndIso)
        .gt("end_time", dayStartIso),
    ]);
    bookings = (b.data as Span[]) ?? [];
    blackouts = (bl.data as Span[]) ?? [];
    // Recurring rules in a separate query so a missing table (pre-migration)
    // can't take out the booking/blackout checks above.
    try {
      const { data } = await supabase
        .from("recurring_blackouts")
        .select("days_of_week,start_minute,end_minute")
        .eq("active", true);
      recurring = (data as RecurRule[]) ?? [];
    } catch {
      /* table not present yet — no recurring rules */
    }
    // Shared-gear block. The CDJs and DJM-A9 in the booth are All Ears rental
    // stock: when a *crewed* job takes both out, the studio can't run at all
    // that day (a dry hire of the same gear doesn't block — see the crew repo's
    // 0101 migration). The DB trigger on `bookings` enforces this regardless of
    // what the UI shows; this call is what greys the day out up front.
    // studio_gear_available() blocks whole NZ days, so one call for the whole
    // day is exact — no need to ask per slot.
    try {
      const { data, error } = await supabase.rpc("studio_gear_available", {
        p_start: dayStartIso,
        p_end: dayEndIso,
      });
      if (!error && data === false) gearBlocked = true;
    } catch {
      /* function not present yet — fall back to the trigger catching it */
    }
  } catch {
    // Supabase not configured (e.g. local dev) — return all slots open.
    console.warn("[availability] Supabase unavailable; returning open slots");
  }

  // NZ-local weekday of the requested calendar date (0=Sun … 6=Sat).
  const [yy, mm, dd] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  const recurringToday = recurring.filter((r) => r.days_of_week?.includes(weekday));

  const overlaps = (s: number, e: number, bs: number, be: number) => s < be && bs < e;

  // Is someone already opening the room this day? If so, starts from that
  // point on only need the short notice — the set-up is happening anyway.
  // The query matches anything *overlapping* the day, so a 23:00–01:00 session
  // from last night is in `bookings`; it doesn't open this one.
  const opensAt = dayOpensAt(
    bookings.filter((b) => new Date(b.start_time).getTime() >= dayStart),
  );

  // Only the weekday-deal flag needs prices here; it still has to be the live
  // ones, or the picker offers a deal the booking API would refuse.
  const pricing = await getPricingSettings();

  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    const start = nzDateHourToUtc(date, h);
    const startMs = start.getTime();
    const endMs = startMs + 3600 * 1000;

    let available = isBookableStart(startMs, opensAt, now) && !gearBlocked;
    if (available) {
      for (const bk of bookings) {
        if (!HOLDS_SLOT.has(bk.status ?? "confirmed")) continue;
        const bs = new Date(bk.start_time).getTime() - BUFFER_MS;
        const be = new Date(bk.end_time).getTime() + BUFFER_MS;
        if (overlaps(startMs, endMs, bs, be)) {
          available = false;
          break;
        }
      }
    }
    if (available) {
      for (const bl of blackouts) {
        if (overlaps(startMs, endMs, new Date(bl.start_time).getTime(), new Date(bl.end_time).getTime())) {
          available = false;
          break;
        }
      }
    }
    // Recurring weekly blackouts — compared purely in NZ-local minutes (this
    // slot covers [h:00, h+1:00) local), so it's DST-proof.
    if (available && recurringToday.length > 0) {
      const slotStartMin = h * 60;
      const slotEndMin = h * 60 + 60;
      for (const r of recurringToday) {
        if (slotStartMin < r.end_minute && r.start_minute < slotEndMin) {
          available = false;
          break;
        }
      }
    }

    slots.push({
      start: start.toISOString(),
      end: new Date(endMs).toISOString(),
      available,
      // A 2-hour session starting here qualifies for the weekday-daytime
      // deal — false throughout when the deal is switched off in /admin/pricing,
      // which is what greys out the deal option card.
      deal_2h: weekdayDealApplies(pricing, start, 2),
    });
  }

  // `opensAt` goes back so the picker can say *why* short-notice starts are
  // open ("someone's in from 2pm") instead of contradicting the 4-hour line
  // it printed on the step before.
  return NextResponse.json({
    date,
    slots,
    opensAt: opensAt !== null ? new Date(opensAt).toISOString() : null,
  });
}
