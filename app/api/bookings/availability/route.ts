import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nzDateHourToUtc } from "@/lib/timezone";
import { isWeekdayDaytime } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const OPEN_HOUR = 10; // studio opens 10:00
const CLOSE_HOUR = 24; // slots start 10:00 … 23:00
const BUFFER_MS = 15 * 60 * 1000;

type Span = { start_time: string; end_time: string };

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const dayStart = nzDateHourToUtc(date, 0).getTime();
  const dayEndIso = new Date(dayStart + 24 * 3600 * 1000).toISOString();
  const dayStartIso = new Date(dayStart).toISOString();
  const now = Date.now();

  type RecurRule = { days_of_week: number[]; start_minute: number; end_minute: number };

  let bookings: Span[] = [];
  let blackouts: Span[] = [];
  let recurring: RecurRule[] = [];
  try {
    const supabase = createAdminClient();
    const [b, bl] = await Promise.all([
      supabase
        .from("bookings")
        .select("start_time,end_time")
        .in("status", ["pending_verification", "confirmed"])
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
  } catch {
    // Supabase not configured (e.g. local dev) — return all slots open.
    console.warn("[availability] Supabase unavailable; returning open slots");
  }

  // NZ-local weekday of the requested calendar date (0=Sun … 6=Sat).
  const [yy, mm, dd] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  const recurringToday = recurring.filter((r) => r.days_of_week?.includes(weekday));

  const overlaps = (s: number, e: number, bs: number, be: number) => s < be && bs < e;

  const slots = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    const start = nzDateHourToUtc(date, h);
    const startMs = start.getTime();
    const endMs = startMs + 3600 * 1000;

    let available = startMs > now;
    if (available) {
      for (const bk of bookings) {
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
      // deal ($60+GST, Mon–Fri inside 10:00–16:00 NZ).
      deal_2h: isWeekdayDaytime(start, 2),
    });
  }

  return NextResponse.json({ date, slots });
}
