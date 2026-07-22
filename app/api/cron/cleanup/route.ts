import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/email";
import { creditBankedHours } from "@/lib/banked-hours";

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

    // Never delete a booking that has (or is having) a Xero invoice raised —
    // its invoice lives on in Xero and may still get paid. Only sweep bookings
    // that were never invoiced (invoice_status null or 'not_invoiced').
    const { data, error } = await supabase
      .from("bookings")
      .delete()
      .eq("status", "pending_verification")
      .lt("created_at", cutoff)
      .or("invoice_status.is.null,invoice_status.eq.not_invoiced")
      .select("id, customer_id, friendly_id, banked_hours_used");

    if (error) throw error;

    // A swept booking that drew banked hours must give them back — the session
    // never happened. (The hour_ledger.booking_id FK is `set null` on delete,
    // so the original debit row survives as history; this posts the credit.)
    const deleted = (data as { id: string; customer_id: string; friendly_id: string; banked_hours_used: number }[] | null) ?? [];
    for (const b of deleted) {
      if (b.banked_hours_used > 0) {
        await creditBankedHours(supabase, {
          customerId: b.customer_id,
          hours: b.banked_hours_used,
          reason: "session_refund",
          note: `Expired unconfirmed booking ${b.friendly_id}`,
        });
      }
    }

    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (e) {
    console.error("[cron/cleanup] failed", e);
    await notifyAdmin("Cron failed — cleanup", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
