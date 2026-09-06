import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { sendIdVerificationLink } from "@/lib/id-verification";

export const dynamic = "force-dynamic";

/**
 * "Post me that link after all."
 *
 * Called by the confirmation page — either because the customer asked for it,
 * or because their five minutes ran out, or because they closed the tab (a
 * `sendBeacon`, which is why nothing here reads the request body and why the
 * answer is always a plain 200-shaped JSON the browser will never look at).
 *
 * It emails the token they are already holding rather than rotating a new one:
 * the page that fired this may still be open, and killing its form under it
 * would turn a helpful email into a broken upload.
 *
 * Idempotent. A link that has already been emailed, already been used, or
 * belongs to someone since verified is a no-op, so a timer firing at the same
 * moment as a beacon costs one duplicate request and no duplicate email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`verify-id-send:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const result = await sendIdVerificationLink(token);

  if (result.status === "failed") {
    // "not_found" / "expired" here means the token is stale, which for a beacon
    // is nothing to shout about — log it and answer plainly.
    console.warn("[verify-id/send] could not send", { reason: result.reason });
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
