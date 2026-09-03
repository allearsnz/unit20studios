import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { sendAccessInstructions } from "@/lib/notifications";

/**
 * POST /api/admin/bookings/:id/resend-access
 *
 * Send the access instructions — how to get in — if they have not gone already.
 *
 * `sendAccessInstructions()` is the ONE place this email is sent, from all three
 * callers (the paid Database Webhook, the admin's "mark paid", and now this).
 * It claims the send atomically by stamping `access_sent_at` only while it is
 * still null, so pressing this twice, or pressing it while the webhook is in
 * flight, cannot double-send. `already_sent` is therefore a normal answer and
 * comes back as a 409 with the reference, not as a failure.
 *
 * Note what this route does NOT do: it does not mint a door code. That is a
 * crew-side database trigger (crew `0050`) fired by payment landing while the
 * session is still ahead, and re-sending an email is not a payment. The email
 * itself already tells the truth about that — `hasDoorCode` is computed from
 * `end_time`, so a session in the past is never promised a code.
 */
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return crewPreflight(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCrew(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return crewJson(req, { error: "That booking reference isn't valid." }, 422);
  }

  const result = await sendAccessInstructions(id);

  switch (result.status) {
    case "sent":
      console.info("[api/admin] access instructions sent", {
        bookingId: id,
        by: auth.crew.email,
      });
      return crewJson(req, { ok: true, friendlyId: result.friendlyId });

    case "already_sent":
      return crewJson(
        req,
        { error: `The access instructions for ${result.friendlyId} have already been sent.` },
        409,
      );

    case "no_email":
      return crewJson(
        req,
        { error: "No email address on file for this customer." },
        409,
      );

    case "send_failed":
      return crewJson(
        req,
        { error: `Couldn't send that: ${result.error ?? "the mail server refused it"}` },
        502,
      );

    // 422, never 404 — see lib/crew-auth.ts.
    case "not_found":
      return crewJson(req, { error: "No such booking in the studio records." }, 422);
  }
}
