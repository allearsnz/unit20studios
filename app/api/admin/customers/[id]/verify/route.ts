import { type NextRequest } from "next/server";
import { crewJson, crewPreflight, isUuid, requireCrew } from "@/lib/crew-auth";
import { verifyCustomerId } from "@/lib/admin-ops";

/**
 * POST /api/admin/customers/:id/verify
 *
 * Approve the customer's ID: set `id_verified` AND delete both images.
 *
 * The deletion is not housekeeping bolted onto a flag write — it is half of the
 * action, and the half a crew-side `UPDATE customers` under crew `0163` cannot
 * do. A flag set without it marks somebody verified and leaves their licence
 * sitting in storage, which is the precise outcome the ID pipeline exists to
 * prevent. That is why this route exists rather than a button wired to Postgres.
 *
 * Re-approving an already-verified customer is reported, not refused: two people
 * looking at the same customer from two apps is now the ordinary case, and
 * `alreadyVerified: true` lets the crew screen say "already done" instead of
 * inventing an error.
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

  const result = await verifyCustomerId(id);
  if (result.status === "customer_not_found") {
    return crewJson(req, { error: "No such customer in the studio records." }, 422);
  }

  console.info("[api/admin] ID verified", { customerId: id, by: auth.crew.email });
  return crewJson(req, { ok: true, alreadyVerified: result.alreadyVerified });
}
