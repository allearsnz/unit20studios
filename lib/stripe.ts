import { createHmac, timingSafeEqual } from "node:crypto";
import { gstInclusiveCents } from "./pricing";
import { site } from "./site";

/**
 * Stripe Checkout — collecting money for a studio booking.
 *
 * WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT (YET).
 *
 * `docs/PLAN-studio-prepay.md` argues for payment *gating* the booking: the
 * customer cannot hold a slot until the money lands. That is the destination.
 * This module is the half of it that is safe to ship on its own — **a payment
 * link for a booking that already exists**. Crew press a button (in this app's
 * admin, or in the crew app's Studio tab), the customer pays, and the webhook
 * marks the booking `paid`.
 *
 * That ordering matters. Everything downstream of `payment_status = 'paid'` is
 * already built and already proven: crew migration `0050`'s trigger enqueues a
 * `studio_door_codes` row, the per-minute cron mints it against TTLock, and
 * `runPaidAutomations()` sends the access instructions. Stripe is a new way for
 * that flag to flip, not a new pipeline. Turning the public booking form into a
 * prepay gate later is then one more caller of `createBookingCheckoutSession()`
 * plus a `checkout.session.expired` handler that releases the hold — see §4 of
 * the plan. Nothing here has to change for that.
 *
 * NO SDK. Same call as `lib/xero.ts`: raw `fetch` against the REST API, with
 * `node:crypto` for the signature. The `stripe` package is ~1MB of client for
 * two endpoints and a HMAC, and the form-encoding below is the whole reason
 * anyone reaches for it.
 *
 * MONEY: `bookings.total_price_cents` is the NET, **ex-GST** total (see
 * `lib/pricing.ts`). A customer pays the GST-INCLUSIVE figure, so every amount
 * that goes to Stripe runs through `gstInclusiveCents()` and every amount that
 * comes back is compared against the same. Getting this backwards undercharges
 * every session by 13%, silently, and the books only disagree at year end.
 *
 * ENV: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Both unset in production
 * until someone sets them, and `stripeConfigured()` is what every caller asks
 * first — the same "it is off until it is configured" rule `lib/xero.ts` and
 * the crew app's `studioApi.ts` both follow, so a button that cannot work is
 * never rendered.
 */

const API_BASE = "https://api.stripe.com/v1";

/** How long a payment link stays live. Stripe allows 30 minutes to 24 hours on
 *  a Checkout Session; a day is right for a link sent by a person, who may well
 *  send it in the evening for a customer who reads email in the morning. The
 *  prepay flow will want minutes, not hours — that is a caller's decision, not
 *  this module's. */
export const LINK_TTL_SECONDS = 24 * 60 * 60;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Verify `stripe-signature`.
 *
 * The header is `t=<unix>,v1=<hex>,v1=<hex>` — more than one `v1` during a
 * secret rotation, which is the whole point of rotation, so ALL of them are
 * checked rather than the first. The signed payload is `${t}.${rawBody}` over
 * the RAW body: re-serialising the JSON changes key order and whitespace and
 * the signature stops matching for reasons that look nothing like the cause.
 *
 * The timestamp window is not optional. Without it a valid-forever signed
 * payload can be replayed at any point in the future by anyone who ever saw
 * it — five minutes is Stripe's own recommendation.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  toleranceSeconds = 300,
): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v ?? "";
    else if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  return signatures.some((sig) => {
    const b = Buffer.from(sig, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

// ---------------------------------------------------------------------------

/** Form-encode the nested shape Stripe's API takes — `a[b][c]=v`. */
function encode(params: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      out.push(...encode(value as Record<string, unknown>, name));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          out.push(...encode(item as Record<string, unknown>, `${name}[${i}]`));
        } else {
          out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

async function stripeFetch<T>(
  path: string,
  params?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured.");

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (params) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method: params ? "POST" : "GET",
    headers,
    body: params ? encode(params).join("&") : undefined,
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!res.ok) {
    throw new Error(payload?.error?.message ?? `Stripe API ${res.status}`);
  }
  return payload as T;
}

// ---------------------------------------------------------------------------

export type CheckoutSession = {
  id: string;
  url: string | null;
  expires_at: number;
  amount_total: number | null;
  currency: string | null;
  payment_status: string; // paid | unpaid | no_payment_required
  client_reference_id: string | null;
  payment_intent: string | null;
  metadata?: Record<string, string> | null;
};

export type BookingForCheckout = {
  id: string;
  friendly_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  /** NET, ex-GST. Converted to GST-inclusive before it reaches Stripe. */
  total_price_cents: number;
  customerEmail: string | null;
  whenLabel: string;
};

/**
 * A Checkout Session for one booking, and the URL to send the customer.
 *
 * THE IDEMPOTENCY KEY CARRIES THE EXPIRY, not just the booking. Keyed on the
 * booking alone, a link re-sent the week after the first one expired would
 * return the DEAD session from Stripe's cache and the customer would open a
 * page telling them the link has expired — the exact failure the button exists
 * to fix. Bucketing by hour means "press it twice by accident" is still one
 * session, and "press it again tomorrow" is a fresh one.
 *
 * `client_reference_id` AND `metadata.booking_id` both carry the booking. They
 * are the same fact twice on purpose: the first is what shows in the Stripe
 * dashboard next to the payment (so a human reconciling can see which session
 * it was), the second is what survives onto the PaymentIntent and into a
 * refund. The webhook reads `client_reference_id` and falls back to metadata.
 */
export async function createBookingCheckoutSession(
  booking: BookingForCheckout,
): Promise<CheckoutSession> {
  const amount = gstInclusiveCents(booking.total_price_cents);
  if (amount <= 0) {
    throw new Error("This booking has nothing to pay — check the price before sending a link.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const hourBucket = Math.floor(expiresAt / 3600);

  return stripeFetch<CheckoutSession>(
    "/checkout/sessions",
    {
      mode: "payment",
      client_reference_id: booking.id,
      expires_at: expiresAt,
      success_url: `${site.url}/studio/book/confirmation?id=${booking.id}&paid=1`,
      cancel_url: `${site.url}/studio/book/confirmation?id=${booking.id}`,
      // Stripe emails its own receipt, which is a valid GST receipt for a
      // session at this price — `PLAN-xero.md` §8.7. Prefilling the address
      // also saves the customer typing it on a phone.
      ...(booking.customerEmail ? { customer_email: booking.customerEmail } : {}),
      metadata: { booking_id: booking.id, friendly_id: booking.friendly_id },
      payment_intent_data: {
        description: `${site.name} studio — ${booking.friendly_id}`,
        metadata: { booking_id: booking.id, friendly_id: booking.friendly_id },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "nzd",
            unit_amount: amount,
            product_data: {
              name: `${site.name} studio session — ${booking.friendly_id}`,
              description: `${booking.whenLabel} · ${booking.duration_hours}h (incl. GST)`,
            },
          },
        },
      ],
    },
    `booking:${booking.id}:checkout:${hourBucket}`,
  );
}

/** Read a session back — the `success_url` fast path, where we confirm the
 *  outcome server-side rather than trusting a redirect that anyone can forge by
 *  typing the URL. */
export function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSession> {
  return stripeFetch<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

/** The booking a webhook event is about. See the note on
 *  `createBookingCheckoutSession` for why there are two places to look. */
export function bookingIdFromSession(session: CheckoutSession): string | null {
  return session.client_reference_id ?? session.metadata?.booking_id ?? null;
}
