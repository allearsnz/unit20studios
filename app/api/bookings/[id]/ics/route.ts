import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBookingIcs } from "@/lib/ics";
import { isFriendlyId } from "@/lib/booking-id";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return new Response("Calendar export unavailable", { status: 503 });
  }

  const column = isFriendlyId(id) ? "friendly_id" : "id";
  const { data } = await supabase
    .from("bookings")
    .select("friendly_id,start_time,end_time")
    .eq(column, id)
    .maybeSingle();

  if (!data) return new Response("Booking not found", { status: 404 });

  const ics = buildBookingIcs(data as { friendly_id: string; start_time: string; end_time: string });
  if (!ics) return new Response("Could not build calendar file", { status: 500 });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="unit20-${(data as { friendly_id: string }).friendly_id}.ics"`,
    },
  });
}
