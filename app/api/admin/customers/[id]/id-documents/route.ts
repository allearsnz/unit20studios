import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { idDocumentsForCustomer } from "@/lib/admin-ops";

/**
 * GET /api/admin/customers/:id/id-documents
 *
 * Both sides of a customer's ID, as signed URLs that die in five minutes.
 *
 * This endpoint is the whole reason the crew app cannot approve an ID by
 * itself. The `id-documents` bucket is private and RLS-denies every role a
 * browser can hold, so there is no unauthenticated read path and no
 * crew-authenticated one either — the signed URL minted here by the service
 * role is the only way to look at the image. Do not cache the response, and do
 * not put it in a query key: the URLs outlive the request by five minutes and
 * nothing else about them is secret.
 */
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return crewPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCrew(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return crewJson(req, { error: "That customer reference isn't valid." }, 422);
  }

  const result = await idDocumentsForCustomer(id);

  switch (result.status) {
    case "ok":
      return crewJson(req, {
        front: result.front,
        back: result.back,
        // What each file actually is. The signed URL is opaque and carries no
        // extension, so without this the only way to render a document is to
        // guess it's an image — and a PDF or a HEIC in an `<img>` is a broken
        // box, which reads as a failed upload rather than a viewer that can't
        // display it. Both formats are accepted deliberately.
        frontFormat: result.frontFormat,
        backFormat: result.backFormat,
        uploadedAt: result.uploadedAt,
        expiresInSeconds: result.expiresInSeconds,
      });

    // 422, never 404 — the crew client reads a 404 as "the studio app hasn't
    // shipped this endpoint" and hides the feature entirely.
    case "customer_not_found":
      return crewJson(req, { error: "No such customer in the studio records." }, 422);

    // Separate answers on purpose. "Already verified" means the images were
    // deleted BECAUSE the check passed; "nothing uploaded" means they were
    // never sent. Collapsing the two is how somebody gets chased for a document
    // that was approved last week.
    case "already_verified":
      return crewJson(
        req,
        { error: "This customer is already ID-verified — the images were deleted on approval." },
        409,
      );
    case "nothing_uploaded":
      return crewJson(
        req,
        { error: "Nothing uploaded yet — send them an ID link." },
        409,
      );
  }
}
