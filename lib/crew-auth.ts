import { type NextRequest, NextResponse } from "next/server";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

/**
 * THE DOOR THE CREW APP KNOCKS ON.
 *
 * `crew.allears.nz` and this app are two independently-deployed frontends over
 * ONE Supabase project (`abqkmovvgkrdunyrqhfp`). The crew app does almost all of
 * its studio work straight against Postgres under RLS — crew `0042` grants the
 * reads, crew `0163` grants `update` on `bookings` and `customers` to anyone
 * holding `studio.manage`. What it cannot do from a browser is anything needing
 * the SERVICE ROLE: minting a signed URL into the private `id-documents`
 * bucket, deleting those images, writing a hashed token to `id_verifications`
 * (RLS on, no policy), or rendering a React Email template through Resend.
 *
 * `app/api/admin/*` is that short list, and this module is its bouncer.
 *
 * TWO CHECKS, AND THEY ARE DIFFERENT QUESTIONS
 * --------------------------------------------
 *  1. WHO — `getClaims(token)` verifies the crew member's own Supabase access
 *     token. Same project, same issuer, so the signature is checkable here.
 *  2. WHETHER — `has_perm('studio.manage')`, called AS THAT USER through a
 *     token-scoped client, not by comparing to ADMIN_EMAIL.
 *
 * The second one is the important design decision. `ADMIN_EMAIL` is one person;
 * `studio.manage` is a permission the owner can grant, revoke, or override for
 * one individual (crew `0163`'s `crew_permissions` table). It is also the exact
 * key the crew app gates its own buttons on, so the button and the endpoint
 * cannot disagree — a crew member who can see the action can perform it, and one
 * whose permission was pulled this morning is refused here this afternoon.
 *
 * WHY `getClaims()` AND NOT `getUser()`
 * -------------------------------------
 * The same reason as `proxy.ts` and `lib/admin-auth.ts`: this project signs with
 * ES256 (see `/auth/v1/.well-known/jwks.json`), so the token is verified locally
 * with WebCrypto against a JWKS that auth-js caches process-globally. `getUser()`
 * is a network round trip to the Auth API. We still make ONE network call — the
 * `has_perm` RPC — but that is a question only the database can answer, and it
 * runs in Tokyo next to the database (`regions: ["hnd1"]` in vercel.json).
 *
 * The trade is the usual one: a crew session revoked server-side stays valid
 * until its access token expires. A revoked *permission*, though, takes effect
 * immediately — that is read live, every call.
 */

/** The only origin allowed to call these routes from a browser. */
export const CREW_ORIGIN = "https://crew.allears.nz";

/** The permission key. Seeded admin-only by crew `0163`, delegatable per-person. */
export const STUDIO_PERM = "studio.manage";

/**
 * CORS, deliberately narrow.
 *
 * The origin is echoed only when it is exactly the crew app — an unknown origin
 * gets no ACAO header at all, so the browser refuses the response, which is the
 * behaviour we want. `Vary: Origin` keeps a CDN from serving one origin's answer
 * to another; nothing here is cacheable anyway, but the header is free and the
 * failure it prevents is not.
 *
 * No `Access-Control-Allow-Credentials`: authentication is a bearer token the
 * crew app attaches by hand, never a cookie. That means a cross-site request
 * from anywhere else carries no ambient authority even if CORS were wrong.
 */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin === CREW_ORIGIN) headers["Access-Control-Allow-Origin"] = CREW_ORIGIN;
  return headers;
}

/** JSON with the CORS headers attached, and never cached — every one of these
 *  responses is about one person's booking or one person's licence. */
export function crewJson(
  req: NextRequest,
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...corsHeaders(req), "Cache-Control": "no-store" },
  });
}

/** Shared preflight handler. Every route re-exports this as `OPTIONS`. */
export function crewPreflight(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// ---------------------------------------------------------------------------

/**
 * A verifier client, made once per process.
 *
 * It holds no session (`persistSession: false`) and is used only to check
 * signatures; the JWKS auth-js fetches on first use is what makes every
 * subsequent `getClaims()` a local WebCrypto operation rather than a request to
 * Tokyo. Rebuilding this per call would still hit auth-js's own global cache,
 * but keeping one instance makes that guarantee obvious rather than incidental.
 */
let verifier: SupabaseClient | null = null;

function getVerifier(url: string, anon: string): SupabaseClient {
  verifier ??= createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return verifier;
}

export type CrewIdentity = {
  /** The crew member's Supabase auth user id (`sub`). */
  userId: string;
  email: string | null;
  /** Their raw access token, for anything that must act as them. */
  token: string;
};

export type CrewAuthResult =
  | { ok: true; crew: CrewIdentity }
  | { ok: false; response: NextResponse };

/**
 * Authenticate and authorise a crew request. Returns either the identity or the
 * response to send back — the caller does `if (!auth.ok) return auth.response`.
 *
 * The status codes are chosen so the crew client can say something true:
 *   401 — no token, or one that doesn't verify. "You are not signed in."
 *   403 — a good token without `studio.manage`. "You don't have permission."
 *   503 — this deployment has no Supabase config. Not the caller's fault.
 *
 * 404 is never used here, and must not be: `src/lib/studioApi.ts` in the crew
 * app reads a 404 as "this build of the studio app hasn't shipped the endpoint"
 * and degrades to a link. A 404 meaning "no such customer" would render as the
 * whole feature being missing.
 */
export async function requireCrew(req: NextRequest): Promise<CrewAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("[crew-auth] Supabase env missing — refusing");
    return {
      ok: false,
      response: crewJson(req, { error: "The studio admin is not configured." }, 503),
    };
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, response: crewJson(req, { error: "Not signed in." }, 401) };
  }

  const { data, error } = await getVerifier(url, anon).auth.getClaims(token);
  const claims = data?.claims ?? null;
  if (error || !claims?.sub) {
    return {
      ok: false,
      response: crewJson(req, { error: "Your session has expired — sign in again." }, 401),
    };
  }

  // Ask the database, as this user. `has_perm` is SECURITY DEFINER and reads
  // `auth.uid()`, so PostgREST validating the same token is what makes the
  // answer about them rather than about us. An error here (network, RPC gone)
  // is deliberately treated as "no" — a permission check that fails open is not
  // a permission check.
  const scoped = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: allowed, error: permError } = await scoped.rpc("has_perm", {
    p_key: STUDIO_PERM,
  });

  if (permError) {
    console.error("[crew-auth] has_perm failed", { sub: claims.sub, permError });
    return {
      ok: false,
      response: crewJson(req, { error: "Could not check your permissions." }, 403),
    };
  }
  if (allowed !== true) {
    return {
      ok: false,
      response: crewJson(
        req,
        { error: "You don't have permission to manage studio bookings." },
        403,
      ),
    };
  }

  return {
    ok: true,
    crew: {
      userId: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : null,
      token,
    },
  };
}

/**
 * Read a JSON body without letting an empty one be an error.
 *
 * Four of these six routes take no arguments, and the crew client sends them
 * with no body and no `Content-Type` at all (see `call()` in
 * `src/lib/studioApi.ts`). Treating that as a malformed request would make
 * every one of them fail.
 */
export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** UUID sanity check, so a junk path segment is a clean 422 rather than a
 *  Postgres `invalid input syntax for type uuid` surfacing as a 500. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
