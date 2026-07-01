import { createElement } from "react";
import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin, sendEmail } from "@/lib/email";
import { formatBookingWhen } from "@/lib/timezone";
import { site } from "@/lib/site";
import BookingReminder from "@/emails/BookingReminder";

type Row = {
  id: string;
  friendly_id: string;
  start_time: string;
  end_time: string;
  customer: { name: string; email: string } | null;
};

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const now = Date.now();
    // Runs once daily (Vercel Hobby cron limit). Widen to the whole next-24h
    // window so every upcoming booking is caught; reminder_sent_at makes it
    // send-once. (Also correct if later moved back to hourly.)
    const from = new Date(now).toISOString();
    const to = new Date(now + 24 * 3600 * 1000).toISOString();

    const { data } = await supabase
      .from("bookings")
      .select("id,friendly_id,start_time,end_time, customer:customers(name,email)")
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .gte("start_time", from)
      .lt("start_time", to);

    const rows = (data as unknown as Row[]) ?? [];
    let sent = 0;
    for (const b of rows) {
      if (!b.customer?.email) continue;
      await sendEmail({
        to: b.customer.email,
        subject: `Reminder — your Unit 20 session (${b.friendly_id})`,
        react: createElement(BookingReminder, {
          firstName: (b.customer.name || "there").split(/\s+/)[0],
          friendlyId: b.friendly_id,
          whenLabel: formatBookingWhen(b.start_time, b.end_time),
          manageUrl: `${site.url}/studio/book/confirmation?id=${b.friendly_id}`,
        }),
      });
      await supabase.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
      sent++;
    }
    return NextResponse.json({ ok: true, found: rows.length, sent });
  } catch (e) {
    console.error("[cron/reminders] failed", e);
    await notifyAdmin("Cron failed — reminders", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
