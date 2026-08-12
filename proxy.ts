import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Guards two authenticated surfaces (and refreshes the auth cookie):
 *   - /admin/*   — requires a session whose email matches ADMIN_EMAIL.
 *   - /account/* — requires ANY signed-in session (a customer). The customers-
 *     row check is done server-side by requireCustomer(); admins may pass
 *     through harmlessly.
 * The auth pages for each surface are public. (Next 16 renamed the convention
 * from `middleware` to `proxy`.)
 */
const PUBLIC_PATHS = [
  "/admin/login",
  "/account/login",
  "/account/signup",
  "/account/forgot",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const isAdmin = pathname.startsWith("/admin");
  const loginPath = isAdmin ? "/admin/login" : "/account/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

  if (!url || !anon) {
    return NextResponse.redirect(new URL(`${loginPath}?e=config`, req.url));
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // `getClaims()`, not `getUser()`. This project signs its JWTs with an
  // asymmetric key (ES256 — see /auth/v1/.well-known/jwks.json), so the token is
  // verified locally with WebCrypto against a cached key set. `getUser()` is a
  // round trip to the Auth API in Tokyo, and this proxy runs on EVERY request to
  // /admin and /account — including every RSC prefetch and every router.refresh.
  // It was the single most-repeated network call in the app.
  //
  // The trade: a session revoked server-side stays valid here until the access
  // token expires, rather than dying on the next request. That is ordinary JWT
  // behaviour and the path Supabase recommends for exactly this case. The
  // signature check is still cryptographic — nothing here trusts the cookie.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : null;

  if (isAdmin) {
    if (!claims || (adminEmail && email !== adminEmail)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  } else {
    // /account/* — any authenticated user. Preserve where they were headed.
    if (!claims) {
      const login = new URL("/account/login", req.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
