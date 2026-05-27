import { createElement } from "react";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, sendEmail } from "@/lib/email";
import { site } from "@/lib/site";
import BookingPostSession from "@/emails/BookingPostSession";

type Row = {
  id: string;
  friendly_id: string;
  customer: { name: string; email: string } | null;
};

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const now = Date.now();
    const from = new Date(now - 3 * 3600 * 1000).toISOString();
    const to = new Date(now - 2 * 3600 * 1000).toISOString();

    const { data } = await supabase
      .from("bookings")
      .select("id,friendly_id, customer:customers(name,email)")
      .eq("status", "confirmed")
      .is("post_session_sent_at", null)
      .gte("end_time", from)
      .lt("end_time", to);

    const rows = (data as unknown as Row[]) ?? [];
    let processed = 0;
    for (const b of rows) {
      if (b.customer?.email) {
        await sendEmail({
          to: b.customer.email,
          subject: "How was your Unit 20 session?",
          react: createElement(BookingPostSession, {
            firstName: (b.customer.name || "there").split(/\s+/)[0],
            bookUrl: `${site.url}/studio/book`,
          }),
        });
      }
      await supabase
        .from("bookings")
        .update({ status: "completed", post_session_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      processed++;
    }
    return NextResponse.json({ ok: true, found: rows.length, processed });
  } catch (e) {
    console.error("[cron/post-session] failed", e);
    await notifyAdmin("Cron failed — post-session", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
