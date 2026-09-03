import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, readJson, requireCrew } from "@/lib/crew-auth";
import { cancelBookingWithEmail } from "@/lib/admin-ops";

/**
 * POST /api/admin/bookings/:id/cancel   { reason?: string }
 *
 * Cancel a booking AND tell the customer.
 *
 * Cancelling on its own is a plain `UPDATE bookings.status` and the crew app
 * does that itself under crew `0163`. What comes through here is the email — and
 * the banked-hours refund, which must happen exactly once and does, because only
 * the first transition into `cancelled` returns a row to act on.
 *
 * `reason` is recorded on `internal_note`, not sent to the customer. An
 * operator's shorthand is a note to the business; the cancellation email keeps
 * its own settled wording.
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

  const body = await readJson<{ reason?: unknown }>(req);
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  const result = await cancelBookingWithEmail(id, reason);

  switch (result.status) {
    case "cancelled":
      console.info("[api/admin] booking cancelled", {
        bookingId: id,
        by: auth.crew.email,
        emailed: result.emailed,
      });
      // `emailed: false` is reported rather than raised. The cancellation itself
      // succeeded and the hours are back; a failed send is worth showing on the
      // screen, not worth telling someone the cancellation didn't happen.
      return crewJson(req, {
        ok: true,
        friendlyId: result.friendlyId,
        emailed: result.emailed,
        refundedHours: result.refundedHours,
      });

    case "already_cancelled":
      return crewJson(
        req,
        { error: `${result.friendlyId} is already cancelled.` },
        409,
      );

    // 422, never 404 — see lib/crew-auth.ts.
    case "booking_not_found":
      return crewJson(req, { error: "No such booking in the studio records." }, 422);
  }
}
