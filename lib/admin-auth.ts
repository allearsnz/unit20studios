import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Redirects to login if the session isn't the admin.
 *
 * Verifies the JWT locally (`getClaims()` — this project signs with ES256, so
 * WebCrypto checks the signature against a cached key set) instead of asking the
 * Auth API who the user is. `getUser()` was a network round trip to Tokyo on
 * every admin page render and, through `assertAdmin`, on every server action —
 * with proxy.ts having already done the same check moments earlier on the same
 * request.
 *
 * Same trade as proxy.ts: a session revoked server-side stays good here until
 * its access token expires, rather than dying on the next request. Ordinary JWT
 * behaviour, and the signature check is still cryptographic.
 */
export async function requireAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : null;

  if (!claims || (adminEmail && email !== adminEmail)) {
    redirect("/admin/login");
  }
  return { id: String(claims.sub), email };
}

/** Boolean variant for server actions (throws on failure). */
export async function assertAdmin() {
  await requireAdmin();
}
