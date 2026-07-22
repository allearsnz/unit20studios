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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdmin) {
    if (!user || (adminEmail && user.email?.toLowerCase() !== adminEmail)) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  } else {
    // /account/* — any authenticated user. Preserve where they were headed.
    if (!user) {
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
