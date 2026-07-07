import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingsCalendar, type FeedBooking } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Subscribable ICS feed of upcoming + recent studio bookings (confirmed +
 * completed), for the owner to add to Google/Apple Calendar.
 *
 * Calendar apps can't send auth headers, so the feed is guarded by an
 * unguessable token in the query string. The token lives in the
 * CALENDAR_FEED_TOKEN env var (set it in Vercel). If the env var is unset the
 * feed is treated as disabled and returns 404 — data is never exposed without
 * a token.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CALENDAR_FEED_TOKEN;
  // Feed disabled until a token is configured — never leak data.
  if (!expected) return new Response("Not found", { status: 404 });

  const token = req.nextUrl.searchParams.get("token");
  if (token !== expected) return new Response("Unauthorized", { status: 401 });

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return new Response("Calendar feed unavailable", { status: 503 });
  }

  const now = Date.now();
  const from = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const to = new Date(now + 365 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from("bookings")
    .select("id,friendly_id,start_time,end_time,status,customer:customers(name)")
    .in("status", ["confirmed", "completed"])
    .gte("end_time", from)
    .lte("end_time", to)
    .order("start_time", { ascending: true })
    .limit(1000);

  const bookings = (data ?? []) as unknown as FeedBooking[];
  const calendar = buildBookingsCalendar(bookings);
  if (calendar === null) {
    return new Response("Could not build calendar feed", { status: 500 });
  }

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": 'inline; filename="unit20-bookings.ics"',
    },
  });
}
