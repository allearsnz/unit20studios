import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Customer } from "@/lib/types";

/**
 * The signed-in account, as read from the verified JWT rather than fetched.
 *
 * Narrower than Supabase's `User` on purpose: these three fields are everything
 * the app used, and all three are claims already inside the token — so getting
 * them costs nothing rather than a round trip to the Auth API in Tokyo.
 */
export type AuthAccount = {
  id: string;
  email: string | null;
  /** From `user_metadata.name`, set at sign-up. */
  name: string | null;
};

export type CustomerSession = {
  user: AuthAccount;
  /**
   * The linked `customers` row, or null when the signed-in account has no
   * bookings/customer record yet (the row is created by the booking flow, then
   * auto-links on the next dashboard visit).
   */
  customer: Customer | null;
};

/**
 * Link/backfill and return the `customers` row for an authenticated user, using
 * the SERVICE ROLE client (bypasses RLS, consistent with the rest of the app).
 *
 * Resolution order:
 *   1. by `auth_user_id` (already linked);
 *   2. else by verified email match → stamps `auth_user_id` so every future
 *      lookup is O(1). The auth email is proven (Supabase verifies it at
 *      sign-up / OTP), so matching on it can't leak another person's history.
 *
 * Returns null when no customers row exists for this account yet.
 */
export async function resolveLinkedCustomer(
  admin: SupabaseClient,
  /** Anything carrying the auth id and email — a Supabase `User` or an
   *  {@link AuthAccount} read from the token. */
  user: { id: string; email?: string | null },
): Promise<Customer | null> {
  const { data: linked } = await admin
    .from("customers")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (linked) return linked as Customer;

  const email = user.email?.toLowerCase();
  if (!email) return null;

  const { data: byEmail } = await admin
    .from("customers")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (!byEmail) return null;

  const row = byEmail as Customer;
  // Backfill the link (best-effort; a race just re-links to the same user).
  const { data: updated } = await admin
    .from("customers")
    .update({ auth_user_id: user.id })
    .eq("id", row.id)
    .is("auth_user_id", null)
    .select("*")
    .maybeSingle();
  return (updated as Customer | null) ?? { ...row, auth_user_id: user.id };
}

/**
 * The current customer session, or null when signed out. Reads the session from
 * the request cookies and resolves the linked customers row via the service
 * role. Safe to call from server components/actions.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const supabase = await createSupabaseServerClient();
  // Verified locally against a cached ES256 key set rather than fetched from the
  // Auth API — see lib/admin-auth.ts for the reasoning and the trade-off. This
  // runs on the account dashboard AND the booking page, both of which a customer
  // hits before they can do anything.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  if (!claims) return null;

  const metaName = (claims.user_metadata as { name?: unknown } | undefined)?.name;
  const user: AuthAccount = {
    id: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : null,
    name: typeof metaName === "string" ? metaName : null,
  };

  let customer: Customer | null = null;
  try {
    customer = await resolveLinkedCustomer(createAdminClient(), user);
  } catch {
    // Service env missing (dev without Supabase) — treat as no linked row.
    customer = null;
  }
  return { user, customer };
}

/**
 * Require a signed-in customer. Redirects to /account/login when signed out.
 * Does NOT require a linked customers row — the dashboard handles the
 * "no bookings yet" empty state itself.
 */
export async function requireCustomer(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  return session;
}
