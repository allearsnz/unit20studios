import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDiscountCode } from "@/lib/discounts";

export const dynamic = "force-dynamic";

/**
 * Public discount-code check for the booking form. Returns only
 * `{ valid, percent, reason }` — never any PII (who it was sent to, the
 * booking it came from, etc.). This is UX only; the booking API re-validates
 * and redeems server-side, so a spoofed response can't change what's charged.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code.trim()) {
    return NextResponse.json({ valid: false, percent: 0, reason: "empty" });
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ valid: false, percent: 0, reason: "unavailable" }, { status: 503 });
  }

  const result = await validateDiscountCode(supabase, code);
  return NextResponse.json({
    valid: result.valid,
    percent: result.percent,
    reason: result.reason,
  });
}
