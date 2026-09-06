import { type NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmin } from "@/lib/email";
import { creditBankedHours } from "@/lib/banked-hours";
import { requestIdVerification, sweepUnsentIdLinks } from "@/lib/id-verification";

/**
 * Nightly sweep of bookings that never got verified.
 *
 * THIS JOB USED TO DELETE PEOPLE'S BOOKINGS. On 10 Aug 2026 it hard-deleted
 * U20-2026-0010 — a real customer, 8 people, $110+GST, session five days away —
 * because the booking was still `pending_verification` and older than 72h. He
 * had done nothing wrong: he booked about two hours before the ID-upload link
 * shipped, so he was never sent a way to verify, and the reminder cron only
 * chases `confirmed` bookings so he was never nudged. The row was destroyed
 * with no email to anyone and no audit trail. The first anyone knew was the
 * customer asking whether he was still booked, and the only surviving evidence
 * was a confirmation email in the owner's inbox.
 *
 * So the job now has three properties it didn't have:
 *
 *   WARN FIRST. A slot is never released unless we have actually asked the
 *   customer for their ID and given them time to answer. `pending_verification`
 *   means "we haven't checked yet" — it is not evidence the customer abandoned
 *   anything, and treating it as such is what caused this.
 *
 *   RELEASE, DON'T DESTROY. Releasing sets `status = 'cancelled'`. The row, its
 *   price, its group size and its friendly_id all survive, so "where did my
 *   booking go" is answerable from the database and reinstating it is a status
 *   change rather than a re-keying exercise from an email.
 *
 *   NEVER SILENTLY. Every release emails the admin with the customer, the slot
 *   and the money, because a freed slot is a commercial event.
 *
 * It also refuses to touch a booking whose session is imminent (< 48h) or
 * already past. A cron cancelling someone's session the day before is worse
 * than holding a slot one more day; those get flagged for a human instead.
 */

const HOURS = 3600 * 1000;
/** Wait this long after booking before asking for ID a second time. */
const WARN_AFTER_H = 24;
/** And this long after that warning before the slot goes back on sale. */
const RELEASE_AFTER_WARNING_H = 48;
/** Never auto-cancel a session closer than this — a human decides. */
const IMMINENT_H = 48;

type PendingRow = {
  id: string;
  friendly_id: string;
  customer_id: string;
  start_time: string;
  created_at: string;
  verification_reminder_at: string | null;
  total_price_cents: number;
  group_size: number;
  banked_hours_used: number;
};

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const now = Date.now();

    // Before anything is judged for not verifying: make sure everyone who was
    // issued a link has actually been given one. A booking is offered the
    // upload form on the confirmation page and the email is held back five
    // minutes; if the browser never came back to ask for it, this is the floor
    // under that. Doing it first matters — the whole point of the warn-then-
    // release ladder below is that we never release a slot from someone we
    // never asked.
    const swept = await sweepUnsentIdLinks(100);

    // Read first, decide in code. The old version expressed the whole policy as
    // a DELETE ... WHERE, which is why a rule nobody had thought through was
    // able to destroy a row before anyone could look at it.
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, friendly_id, customer_id, start_time, created_at, verification_reminder_at, total_price_cents, group_size, banked_hours_used",
      )
      .eq("status", "pending_verification")
      .or("invoice_status.is.null,invoice_status.eq.not_invoiced");
    if (error) throw error;

    const pending = (data as PendingRow[] | null) ?? [];
    const warned: string[] = [];
    const released: PendingRow[] = [];
    const heldBackImminent: PendingRow[] = [];

    for (const b of pending) {
      const startsIn = new Date(b.start_time).getTime() - now;
      const ageH = (now - new Date(b.created_at).getTime()) / HOURS;

      // Past sessions are somebody else's problem (post-session cron), and a
      // session about to happen is never auto-cancelled — if someone turns up
      // unverified that is a conversation at the door, not a silent deletion.
      if (startsIn <= 0) continue;
      if (startsIn < IMMINENT_H * HOURS) {
        heldBackImminent.push(b);
        continue;
      }

      if (!b.verification_reminder_at) {
        if (ageH < WARN_AFTER_H) continue;
        // Rotates the link and emails it. Never throws.
        const res = await requestIdVerification(b.customer_id);
        // Only stamp when it actually went — otherwise a customer who never
        // received anything would still be on the clock towards release.
        if (res.status === "sent") {
          await supabase
            .from("bookings")
            .update({ verification_reminder_at: new Date().toISOString() })
            .eq("id", b.id);
          warned.push(b.friendly_id);
        } else if (res.status === "skipped" && res.reason === "already_verified") {
          // Verified since booking but the status never caught up — confirm it
          // rather than chasing them for something they've already sent.
          await supabase.from("bookings").update({ status: "confirmed" }).eq("id", b.id);
        }
        continue;
      }

      const sinceWarnH = (now - new Date(b.verification_reminder_at).getTime()) / HOURS;
      if (sinceWarnH >= RELEASE_AFTER_WARNING_H) released.push(b);
    }

    for (const b of released) {
      const { error: relErr } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", b.id);
      if (relErr) throw relErr;

      // A released booking that drew banked hours must give them back — the
      // session never happened. (Unchanged from the delete-era behaviour.)
      if (b.banked_hours_used > 0) {
        await creditBankedHours(supabase, {
          customerId: b.customer_id,
          hours: b.banked_hours_used,
          reason: "session_refund",
          note: `Released unverified booking ${b.friendly_id}`,
        });
      }
    }

    // Tell a human. A slot going back on sale is a commercial event, and the
    // whole reason this incident was invisible for four days is that nothing
    // here ever spoke.
    if (released.length || heldBackImminent.length) {
      const lines: string[] = [];
      if (released.length) {
        lines.push(
          `Released ${released.length} unverified booking(s) — status set to cancelled, NOT deleted, so each can be reinstated:`,
          ...released.map(
            (b) =>
              `  ${b.friendly_id} · ${new Date(b.start_time).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })} · ${b.group_size} people · $${(b.total_price_cents / 100).toFixed(2)} + GST`,
          ),
        );
      }
      if (heldBackImminent.length) {
        lines.push(
          "",
          `Still unverified but NOT released, session within ${IMMINENT_H}h — your call:`,
          ...heldBackImminent.map(
            (b) =>
              `  ${b.friendly_id} · ${new Date(b.start_time).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })}`,
          ),
        );
      }
      await notifyAdmin("Studio — unverified bookings", lines.join("\n"));
    }

    return NextResponse.json({
      ok: true,
      id_links_swept: swept.sent,
      warned: warned.length,
      released: released.length,
      held_back_imminent: heldBackImminent.length,
      // `deleted` is kept at 0 so any dashboard or log filter watching the old
      // field doesn't silently read "nothing happened" forever.
      deleted: 0,
    });
  } catch (e) {
    console.error("[cron/cleanup] failed", e);
    await notifyAdmin("Cron failed — cleanup", String(e));
    return NextResponse.json({ error: "cron_failed" }, { status: 500 });
  }
}
