import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/email";

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

    const { data, error } = await supabase
      .from("bookings")
      .delete()
      .eq("status", "pending_verification")
      .lt("created_at", cutoff)
      .select("id");

    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
  } catch (e) {
    console.error("[cron/cleanup] failed", e);
    await notifyAdmin("Cron failed — cleanup", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
