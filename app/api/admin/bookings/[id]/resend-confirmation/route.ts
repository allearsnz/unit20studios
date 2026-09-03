import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { resendBookingConfirmation } from "@/lib/admin-ops";

/**
 * POST /api/admin/bookings/:id/resend-confirmation
 *
 * Re-send whichever confirmation the booking's status actually warrants: the
 * "you're booked" email for a confirmed or completed session, the "we've got
 * your request" one — which asks for ID — for anything still pending.
 *
 * Sending the wrong one is the failure worth naming. Telling an unverified
 * customer they are confirmed is a promise nothing downstream keeps: no door
 * code is minted, no access instructions go out, and the cleanup cron will
 * eventually release the slot. The template choice belongs next to the booking
 * row, which is why the caller doesn't get to pick it.
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

  const result = await resendBookingConfirmation(id);

  switch (result.status) {
    case "sent":
      console.info("[api/admin] confirmation resent", {
        bookingId: id,
        by: auth.crew.email,
        template: result.template,
      });
      return crewJson(req, {
        ok: true,
        friendlyId: result.friendlyId,
        template: result.template,
      });

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
    case "booking_not_found":
      return crewJson(req, { error: "No such booking in the studio records." }, 422);
  }
}
