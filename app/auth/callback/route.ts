import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * PKCE magic-link callback. Supabase redirects here with a `?code=` param;
 * we exchange it for a session (cookies are written onto the redirect
 * response via the server client) and forward to the admin.
 *
 * Not matched by proxy.ts (matcher is /admin/:path*), so unauthenticated
 * requests reach this handler.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next") ?? "/admin";
  // Only allow same-origin relative paths ("/..." but not "//...").
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/admin";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/admin/login?e=auth", request.url));
}
