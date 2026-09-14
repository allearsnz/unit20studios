import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { createPaymentLinkForBooking } from "@/lib/stripe-booking";

/**
 * POST /api/admin/bookings/:id/payment-link
 *
 * Mint a Stripe Checkout link for a booking and hand it back. The crew app
 * copies it, or sends it to the customer; when they pay,
 * `/api/webhooks/stripe` marks the booking `paid` and everything downstream —
 * door code, access instructions — happens exactly as it does for a payment
 * marked by hand.
 *
 * This is the seventh route under `app/api/admin/*` and follows the same three
 * rules as the other six (`lib/crew-auth.ts`):
 *
 *   * authorised by the crew member's OWN token plus `has_perm('studio.manage')`
 *     — the same key the crew app gates the button on, so the button and the
 *     endpoint cannot disagree;
 *   * CORS for `https://crew.allears.nz` and nowhere else;
 *   * **404 is never returned**. The crew client reads a 404 as "this build of
 *     the studio app hasn't shipped the endpoint" and degrades to a link, so an
 *     unknown booking is a 422 and a refusal is a 409.
 *
 * 503 is reserved for "Stripe isn't switched on here", which is a deployment
 * fact rather than anything the caller did — and it is what the crew app shows
 * as "payments aren't configured yet" rather than an error.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const result = await createPaymentLinkForBooking(id);

  switch (result.status) {
    case "ok":
      console.info("[api/admin] payment link created", {
        bookingId: id,
        friendlyId: result.friendlyId,
        by: auth.crew.email,
      });
      return crewJson(req, {
        url: result.url,
        expiresAt: new Date(result.expiresAt * 1000).toISOString(),
        amountCents: result.amountCents,
        friendlyId: result.friendlyId,
      });

    case "not_configured":
      return crewJson(
        req,
        { error: "Card payments aren't switched on for the studio yet." },
        503,
      );

    case "already_paid":
      return crewJson(
        req,
        { error: `${result.friendlyId} is already paid — there's nothing to collect.` },
        409,
      );

    case "cancelled":
      return crewJson(req, { error: "That booking is cancelled." }, 409);

    case "nothing_to_pay":
      return crewJson(
        req,
        {
          error: `${result.friendlyId} has nothing to pay — it's a banked-hours or comped session.`,
        },
        409,
      );

    case "failed":
      return crewJson(req, { error: `Stripe wouldn't make the link: ${result.error}` }, 502);

    // 422, never 404 — see lib/crew-auth.ts.
    case "not_found":
      return crewJson(req, { error: "No such booking in the studio records." }, 422);
  }
}
