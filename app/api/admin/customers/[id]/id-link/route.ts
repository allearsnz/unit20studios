import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { requestIdVerification } from "@/lib/id-verification";

/**
 * POST /api/admin/customers/:id/id-link
 *
 * Email a fresh ID-upload link, ROTATING the token so any previous link dies.
 *
 * The rotation is the feature, not a side effect: it is how a link that has
 * gone astray gets killed, and it is why a "resend" can never leave two working
 * ways in. Only the SHA-256 of the token is stored, and `id_verifications` has
 * RLS on with no policy at all — so this cannot be done from a browser holding
 * a crew token, only by the service role.
 *
 * `requestIdVerification()` never throws by design (it also runs off the back of
 * booking creation, where an email problem must not cost someone their slot), so
 * every outcome arrives as a status to be translated rather than an exception.
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
    return crewJson(req, { error: "That customer reference isn't valid." }, 422);
  }

  // Forced, like the admin server action it mirrors: a crew member pressing
  // "resend" over an upload that is already sitting there is asking for a
  // better photo, not being told there's nothing to do. The automatic callers
  // (booking creation, the nightly chase) leave a pending submission alone.
  const result = await requestIdVerification(id, { force: true });

  switch (result.status) {
    case "sent":
      console.info("[api/admin] ID link sent", { customerId: id, by: auth.crew.email });
      return crewJson(req, { ok: true, email: result.email });

    case "skipped":
      // Each of these is a different sentence to whoever pressed the button.
      // 422 for "no such customer" (never 404 — see lib/crew-auth.ts), 409 for
      // "there is nothing to do here".
      if (result.reason === "customer_not_found") {
        return crewJson(req, { error: "No such customer in the studio records." }, 422);
      }
      if (result.reason === "already_verified") {
        return crewJson(req, { error: "This customer is already ID-verified." }, 409);
      }
      if (result.reason === "already_submitted") {
        // Unreachable while this call is forced — kept so that flipping that
        // back doesn't quietly start reporting it as a missing email address.
        return crewJson(
          req,
          { error: "Their ID is already uploaded and waiting to be approved." },
          409,
        );
      }
      return crewJson(
        req,
        { error: "No email address on file for this customer." },
        409,
      );

    case "failed":
      return crewJson(
        req,
        { error: `Couldn't send the ID link: ${result.reason}` },
        502,
      );
  }
}
