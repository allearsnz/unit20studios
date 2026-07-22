import { createElement } from "react";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, sendEmail } from "@/lib/email";
import { grantMilestoneRewards } from "@/lib/rewards";
import { site } from "@/lib/site";
import BookingPostSession from "@/emails/BookingPostSession";

type Row = {
  id: string;
  friendly_id: string;
  customer_id: string;
  customer: { name: string; email: string } | null;
};

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const now = Date.now();
    // Runs once daily (Vercel Hobby cron limit). Catch every session that ended
    // in the last 24h; post_session_sent_at makes it send-once. (Also correct
    // if later moved back to hourly.)
    const from = new Date(now - 24 * 3600 * 1000).toISOString();
    const to = new Date(now).toISOString();

    const { data } = await supabase
      .from("bookings")
      .select("id,friendly_id,customer_id, customer:customers(name,email)")
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

    // Mint milestone rewards for every customer whose play time just grew.
    // Idempotent (CAS on rewards_granted_hours) and best-effort per customer.
    const customerIds = [...new Set(rows.map((b) => b.customer_id).filter(Boolean))];
    let rewarded = 0;
    for (const id of customerIds) {
      try {
        await grantMilestoneRewards(supabase, id);
        rewarded++;
      } catch (e) {
        console.error("[cron/post-session] reward grant failed", id, e);
      }
    }
    return NextResponse.json({ ok: true, found: rows.length, processed, customers: rewarded });
  } catch (e) {
    console.error("[cron/post-session] failed", e);
    await notifyAdmin("Cron failed — post-session", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
