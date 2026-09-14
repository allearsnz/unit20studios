# Stripe — taking card payments for a studio booking

**Status:** built, and **inert until two secrets are set**. Shipped Sep 2026.

What exists and what it is for, in one paragraph: crew can now mint a **Stripe
Checkout link for a booking that already exists**, from this app or from the
crew app's Studio tab. The customer pays, Stripe posts to
`/api/webhooks/stripe`, and the booking's `payment_status` becomes `paid` —
which is the flag the **door code** (crew migration `0050`'s trigger) and the
**access-instructions email** (`runPaidAutomations`) have always hung off.
Stripe is a new way for that flag to flip, not a new pipeline.

---

## Why this shape, and not the prepay gate yet

[`PLAN-studio-prepay.md`](PLAN-studio-prepay.md) argues for payment *gating* the
booking: the customer cannot hold a slot until the money lands. That is the
destination, and its §3 makes the case for Stripe over a Xero pay-now link far
better than this file could. It is also a change to the **public booking flow**
— holds, expiry, releasing a slot when `checkout.session.expired` arrives,
crediting banked hours back — and a change to what every customer experiences.

So this is the half that is safe on its own. It touches no public page, no
`create_booking_slot`, no cron, and nothing a customer sees unless somebody
sends them a link. And it is not throwaway: the prepay flow is the same
`createBookingCheckoutSession()` and the same webhook with a different caller
and one extra event handler.

## The files

| File | What |
|---|---|
| `lib/stripe.ts` | Stripe, and nothing about bookings. Signature verification, Checkout session create/retrieve. Raw `fetch`, no SDK — same call as `lib/xero.ts`. |
| `lib/stripe-booking.ts` | The only module that knows about both. `createPaymentLinkForBooking()`, `recordStripePayment()`. |
| `app/api/webhooks/stripe/route.ts` | `checkout.session.completed` → paid. |
| `app/api/admin/bookings/[id]/payment-link/route.ts` | The crew-facing route (`lib/crew-auth.ts`, CORS to `crew.allears.nz` only). |

On the crew side: `src/lib/studioApi.ts` → `createStudioPaymentLink()`, rendered
as "Card payment link" on the booking's Payment & invoicing card
(`src/pages/StudioBookingDetail.tsx`).

## Five things worth not breaking

1. **The amount is GST-INCLUSIVE; `total_price_cents` is not.** Stored prices
   are ex-GST (`lib/pricing.ts` says so outright), so every amount that goes to
   Stripe runs through `gstInclusiveCents()`. Getting this backwards undercharges
   every session by 13%, silently, and the books only disagree at year end. The
   crew app carries a mirror of that function, pinned by its `check:logic`.

2. **The raw body, then verify, then parse.** The signature is a HMAC over
   `${timestamp}.${rawBody}`. Parsing and re-serialising reorders keys and the
   signature stops matching for a reason that looks nothing like the cause.
   `verifyStripeSignature` also checks ALL `v1` values (there is more than one
   during a secret rotation, which is the point of rotation) and enforces a
   five-minute timestamp window, without which a signed payload is replayable
   for ever by anyone who saw it.

3. **The claim is the `neq('payment_status', 'paid')` filter**, exactly as
   `setPaymentStatus` does it. Stripe delivers at least once and the
   `success_url` path calls the same function, so only the UPDATE that actually
   MOVES the row runs the automations. Two deliveries send one access email.

4. **A payment for a CANCELLED booking is never marked paid.** It returns
   `paid_but_cancelled`, logs an error, and stops. Marking it paid would mint a
   door code for a session that is not happening and email the customer
   directions to it. That is a refund and a person, not a status write.

5. **Status codes are a retry contract.** Stripe retries any non-2xx for three
   days and disables an endpoint that keeps failing. An unknown booking, an
   unpaid session and an already-recorded payment are all **200** — retrying
   fixes none of them. Only a genuinely transient failure is a 500.

## Turning it on

1. **Stripe dashboard → Developers → API keys.** Copy the secret key. Use the
   **test** key first: `sk_test_…`. Everything below works identically in test
   mode, and test mode is the whole reason this is Stripe rather than a Xero
   pay-now link — there is no rehearsal for the Xero route (`PLAN-studio-prepay.md`
   §3.1).

2. **Vercel → `unit20studios` → Settings → Environment Variables:**

   ```
   STRIPE_SECRET_KEY       sk_test_…   (then sk_live_… when you are happy)
   STRIPE_WEBHOOK_SECRET   whsec_…     (from step 3)
   ```

3. **Stripe dashboard → Developers → Webhooks → Add endpoint.**

   ```
   URL     https://studio.unit20.nz/api/webhooks/stripe
   Events  checkout.session.completed
   ```

   Copy the signing secret it gives you into `STRIPE_WEBHOOK_SECRET`.

4. **Redeploy** (the env vars are read at request time, but the deploy is what
   picks them up).

5. **Rehearse it end to end, in test mode.** Make a booking for a session
   *tomorrow* (the automations deliberately skip a session that has already
   finished), press "Card payment link" in the crew app, pay with `4242 4242
   4242 4242`, any future expiry, any CVC. Then check, in order:

   - the booking flips to **paid** in `/admin`;
   - `payment_method` is `stripe` and `stripe_payment_intent_id` is set;
   - a `studio_door_codes` row appears and mints;
   - the access-instructions email arrives.

   If the booking goes paid but no email arrives, the problem is the
   access-instructions path, not Stripe — see the Automation tab, and
   `all-ears-crew/docs/STUDIO-BRIDGE.md` §2 for the Database Webhook check.

6. **Swap to live keys** (`sk_live_…` and a second webhook endpoint with its own
   `whsec_…`) when the rehearsal is clean. Keep the test endpoint; it costs
   nothing and is where every future change gets rehearsed.

Until step 2 is done the route answers **503** and the crew app shows "Card
payments aren't switched on for the studio yet" rather than an error — the same
off-until-configured rule as `VITE_STUDIO_API_URL` one level up.

## What this deliberately does not do

- **Refunds.** An API call away (`POST /v1/refunds` against the PaymentIntent,
  which is stored on the booking), but a refund is a judgement about a customer,
  not an event. Do them in the Stripe dashboard.
- **Write anything to Xero.** See [`PLAN-xero.md`](PLAN-xero.md). The
  recommendation there is a **weekly summary invoice**, not one per booking, and
  it needs decisions only Will can make (§8) plus the NZ$10/month Custom
  Connection. Stripe collecting first is what makes that summary clean: Xero
  only ever sees real, paid bookings.
- **Gate the public booking form.** That is the prepay plan, and it needs a
  `checkout.session.expired` handler and a slot-release sweep before it is safe.
