import { type NextRequest, NextResponse } from "next/server";
import {
  type CheckoutSession,
  stripeWebhookConfigured,
  verifyStripeSignature,
} from "@/lib/stripe";
import { recordStripePayment } from "@/lib/stripe-booking";

/**
 * POST /api/webhooks/stripe — the truth about whether the money landed.
 *
 * Point Stripe at this and subscribe to **`checkout.session.completed`**. The
 * `success_url` the customer is redirected to is a convenience, not evidence:
 * anyone can type it, and a customer who closes the tab before it loads has
 * still paid. This is the path that decides.
 *
 * WHY THE RAW BODY. The signature is a HMAC over `${timestamp}.${rawBody}`, so
 * the bytes Stripe sent have to be the bytes we hash. `req.text()` first,
 * verify, and only then `JSON.parse` — parsing and re-serialising reorders keys
 * and the signature stops matching for a reason that looks nothing like the
 * cause. This is also why the route cannot use a typed body parser.
 *
 * WHAT IT ANSWERS, AND WHY THE STATUS CODES MATTER. Stripe retries on any
 * non-2xx for up to three days, so a 500 must mean "try me again" and nothing
 * else. An event about a booking we do not recognise, a session that was not
 * paid, or a payment we have already recorded is a **200** — retrying will not
 * change any of them, and a permanently-failing endpoint gets disabled.
 *
 * `paid_but_cancelled` is the exception worth staring at: it is a 200 (retrying
 * will not un-cancel the booking) but it is logged as an error, because it is
 * money taken for a slot that no longer exists and somebody has to refund it.
 */
export const dynamic = "force-dynamic";
// Signature verification needs Node's crypto and the untouched request body.
export const runtime = "nodejs";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: CheckoutSession };
};

export async function POST(req: NextRequest) {
  if (!stripeWebhookConfigured()) {
    console.error("[webhooks/stripe] STRIPE_WEBHOOK_SECRET not set — refusing");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Everything else Stripe might send (payment_intent.*, charge.*, the test
  // ping) is acknowledged and ignored. Subscribing to fewer event types in the
  // dashboard is better than filtering here, but a dashboard is not a contract.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const session = event.data?.object;
  if (!session?.id) return NextResponse.json({ ok: true, ignored: "no session" });

  try {
    const result = await recordStripePayment(session);
    if (result.status === "recorded") {
      console.info("[webhooks/stripe] booking paid", {
        bookingId: result.bookingId,
        friendlyId: result.friendlyId,
        sessionId: session.id,
      });
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    // A genuinely transient failure — the database was unreachable, the access
    // email threw somewhere it was not supposed to. This is the one case worth
    // a redelivery, and `recordStripePayment`'s claim makes the retry safe.
    console.error("[webhooks/stripe] failed to record payment", e);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
