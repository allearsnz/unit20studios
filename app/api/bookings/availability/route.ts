import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPeakInstant, nzDateHourToUtc } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const OPEN_HOUR = 7;
const CLOSE_HOUR = 24; // slots start 07:00 … 23:00
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

  let bookings: Span[] = [];
  let blackouts: Span[] = [];
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
  } catch {
    // Supabase not configured (e.g. local dev) — return all slots open.
    console.warn("[availability] Supabase unavailable; returning open slots");
  }

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

    slots.push({
      start: start.toISOString(),
      end: new Date(endMs).toISOString(),
      available,
      is_peak: isPeakInstant(start),
    });
  }

  return NextResponse.json({ date, slots });
}
