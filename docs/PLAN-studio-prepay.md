# PLAN — pay before you book, then the door code issues itself

**Status:** planning doc — nothing here is built yet. Architecture is **decided** (§3).
**Relationship to [`PLAN-xero-invoicing.md`](PLAN-xero-invoicing.md):** that plan designed
*invoice-then-pay* (owner approves → invoice emailed → customer pays whenever) and most of it is
already built. This doc covers the change of shape the new ask implies — **payment gates the
booking** — and keeps Xero as the book of record rather than the payment gate.

---

## 0. TL;DR

**Charge with Stripe Checkout directly. Write the invoice into Xero after the money lands.**

Three things make this smaller than it looks:

1. **Door codes are done and proven.** A trigger on `bookings` fires when `payment_status`
   becomes `'paid'`, queues a code for the exact session window, a per-minute cron mints it
   against the studio TTLock, and the function emails it. The lock has now been tested working
   from the crew app — same function, same code path. Nothing to build; it just needs `paid` to
   happen earlier.
2. **The Xero write-up is mostly built.** `invoiceBooking()`, contact find-or-create, invoice
   creation with an idempotency key, and the payment webhook all exist and are dormant for want of
   env vars. Only one new Xero call is needed: apply a payment to the invoice.
3. **Everything downstream keys off `payment_status`.** Whatever collects the money, the rest of
   the system — confirmation email, ICS, access instructions, door code — is already wired.

So the new build is: a Checkout session in front of the booking, a webhook, a hold that expires,
and one `PUT /Payments` call so Xero shows the invoice settled.

---

## 1. What the new ask changes

| | Old plan | This plan |
|---|---|---|
| Trigger | owner approves a request | customer pays |
| Booking at creation | held for the owner | held for the payer, with a deadline |
| Payment | invoice emailed, paid whenever | must clear before the slot is theirs |
| Unpaid after the deadline | admin gets nagged | **slot is released automatically** |
| Door code | on paid (already) | on paid (already, just sooner) |

The old `pending_verification → confirmed` gate asked *does the owner trust this customer*. The
new gate asks *has the money landed*. They're different questions and both survive: prepayment
doesn't prove someone is over 18 (§8, Q4).

---

## 2. What already exists — verified in the code, not assumed

| Piece | Where | State |
|---|---|---|
| Xero token, contact find-or-create, invoice create, online-invoice URL, `emailInvoice` | `lib/xero.ts` | **written** |
| `invoiceBooking()` — atomic `not_invoiced → creating` claim, rollback on failure, skips $0 and already-invoiced | `lib/xero-booking.ts` | **written** |
| Xero payment webhook → `payment_status='paid'` | `app/api/webhooks/xero/route.ts` | **written** |
| `paid` → access-instructions email (idempotent via `access_sent_at`) | `app/api/hooks/booking-paid/route.ts` | **live** |
| Invoice columns (`xero_invoice_id`, `online_invoice_url`, `invoice_status`, `paid_at`) | `lib/types.ts` + crew migration | **live** |
| `payment_method = 'stripe'`, `stripe_payment_intent_id` — designed for this, never used | `0001_init.sql` | **live, unused** |
| Race-safe slot claim | `create_booking_slot()`, studio `0002` | **live** |
| Cleanup cron already refuses to sweep invoiced bookings | `app/api/cron/cleanup/route.ts` | **live** |
| **Door codes**: `studio_door_codes` + `paid` trigger + per-minute mint cron + code email | crew `0050`/`0051`/`0054`, `issue-studio-door-code` | **live, lock tested working** |

---

## 3. The decision: Stripe Checkout collects, Xero records

Both routes end at the same place — `payment_status='paid'` — so the choice is only about how the
money is collected. Six things decide it, and they all point the same way.

**1. You can't test the Xero route.** Xero has **no sandbox for a Custom Connection** — the
connection is authorised against the live All Ears org, so the first genuine test of the payment
path involves real money in the real books, and every rehearsal leaves a voided invoice behind.
Stripe has full test mode, `stripe listen` for local webhook delivery, and webhook replay from the
dashboard. *You cannot make robust something you cannot rehearse*, and robustness is the
requirement.

**2. A Xero invoice has no expiry — and that's the worst failure in the system.** The pay-now link
lives forever. Customer starts a booking, doesn't pay, the hold lapses, the slot goes to someone
else — and three days later they open the old email and pay. Money taken, no slot, manual refund,
angry customer. Stripe makes that structurally impossible: `expires_at` (30 minutes–24 hours),
`checkout.session.expired` to release the hold, and an `/expire` endpoint to kill a session early.
Stripe documents this exact pattern for event-ticket inventory, which is precisely this problem.

**3. Two independent confirmation paths instead of one.** Checkout returns the customer to our
`success_url`, where we retrieve the session server-side and confirm immediately; the webhook is
the backstop. The Xero invoice page has nowhere to send them and no way back — the webhook is the
*only* path, so a single delivery failure means a paid customer with no booking and no door code.

**4. "Paid" is unambiguous.** A Checkout session is paid or it isn't. A Xero invoice page also
offers bank transfer and accepts partial payment, so "they pressed pay" ≠ "money landed" ≠ "the
slot is theirs".

**5. Refunds are an API call** against the PaymentIntent rather than a credit-note dance.
Prepayment makes refunds routine, so this stops being a footnote.

**6. It gives *cleaner* books, not messier.** This is the counter-intuitive one. The Xero route
must create the invoice **before** it knows whether anyone will pay, so every abandoned booking
leaves an invoice to void — the ledger fills with noise from people who never became customers.
Collecting first and invoicing after means **Xero only ever sees real bookings**.

Cost is a wash: the same Stripe account, the same fees. The Custom Connection (NZ$10/mo) is still
wanted, but for writing the books rather than gating the door.

---

## 4. Architecture

```
customer completes the form
  └─ POST /api/bookings   (unchanged: create_booking_slot() takes the slot atomically)
       status = pending_verification, invoice_status = not_invoiced   ← this IS the hold
  └─ create Stripe Checkout Session
       expires_at = now + HOLD_MINUTES,  client_reference_id = booking.id
       idempotency key = booking:<id>:checkout
       success_url = /studio/book/confirmation?session_id={CHECKOUT_SESSION_ID}
       cancel_url  = back into the flow
  └─ respond { checkoutUrl } → redirect

customer pays
  ├─ success_url → we retrieve the session server-side and show the real outcome  (fast path)
  └─ webhook checkout.session.completed                                            (truth)
       └─ mark paid FIRST — payment_method='stripe', stripe_payment_intent_id, payment_status='paid'
            ├─ booking-paid hook → confirmed + BookingConfirmed + ICS + access email   (built)
            └─ crew trigger → door code minted → emailed                                (built)
       └─ THEN write the books (never blocking the customer):
            invoiceBooking()            → ACCREC invoice, AUTHORISED                    (built)
            applyInvoicePayment()       → PUT /Payments against the Stripe clearing acct (new)
                                          → invoice reads PAID in Xero

customer doesn't pay
  └─ webhook checkout.session.expired → release the slot, credit banked hours back,
     release any discount code
  └─ plus a sweep cron, in case that webhook never arrives
```

### The ordering rule that makes it robust

**Money → booking → books, in that order, each independent of the next.** Xero being slow, down,
or misconfigured must never stop a paid customer walking through the door. So the webhook marks
the booking paid and returns; the Xero write-up is a separate retryable step driven off
`invoice_status`, exactly the way `invoiceBooking()` already claims and rolls back. A Xero outage
costs you a delayed ledger entry, not a locked-out customer at 9pm.

### Work items

1. `lib/stripe.ts` — client, `createCheckoutSession(booking)`, `retrieveSession(id)`,
   `expireSession(id)`, `refundPayment(paymentIntentId)`. Line items mirror
   `calcBookingPriceCents` (session + group surcharge), NZD, amounts in cents ex-GST with GST as
   its own consideration — match whatever `createBookingInvoice()` already emits so the two agree.
2. `app/api/webhooks/stripe/route.ts` — signature verification against `STRIPE_WEBHOOK_SECRET`,
   raw body, handles `checkout.session.completed` and `checkout.session.expired`. Idempotent: the
   paid flip stays guarded by `.neq('payment_status','paid')`, the release is a no-op on an
   already-paid booking.
3. `app/api/bookings/route.ts` — after `create_booking_slot()`, create the session and return
   `checkoutUrl`. If Stripe is unconfigured or errors, **fall back to today's pay-in-person
   behaviour** rather than losing the booking (§8, Q5).
4. `components/booking/BookingFlow.tsx` — redirect to `checkoutUrl` when present; the Review
   step's "Payment happens in person" copy becomes conditional.
5. `app/(site)/studio/book/confirmation` — read `session_id`, retrieve server-side, show paid /
   still-processing / expired honestly rather than assuming success.
6. `lib/xero.ts` — add `applyInvoicePayment(invoiceId, amount, date)`:
   `PUT /Payments` with `{ Invoice: { InvoiceID }, Account: { AccountID: XERO_STRIPE_ACCOUNT_ID },
   Date, Amount }`. The account must be a bank account or have `EnablePaymentsToAccount` set —
   the Stripe clearing account already in use qualifies (§8, Q1).
7. `lib/xero-booking.ts` — extend to invoice-then-pay in one call for the post-payment path, so an
   invoice is never left AUTHORISED-but-unpaid when the money is already in.
8. **Reconciliation cron** (the safety net, both directions):
   - Stripe sessions paid in the last 24 h whose booking isn't `paid` → repair.
   - Bookings `paid` with `invoice_status` not `paid` → retry the Xero write-up.
   - Holds past their deadline still unpaid → expire the session, release the slot.
9. Refund path in admin, wired to the cancellation policy (§8, Q3), plus a Xero credit note.

### Data model

**No new columns and no new status values.** A hold is already expressible as
`status='pending_verification'` + `payment_status='unpaid'`, and availability already treats
`pending_verification` as blocking, so the slot is held the moment the row exists. `payment_method`
and `stripe_payment_intent_id` exist and finally get used. `bookings.status` is a CHECK-constrained
column on the **shared** database that the crew app reads — not worth widening for this.

Only config is new: `HOLD_MINUTES` (§8, Q2).

---

## 5. Door codes — done

`payment_status='paid'` → `trg_studio_booking_paid` (SECURITY DEFINER, failure-swallowing so it
can never roll back a payment) → `studio_door_codes` row → per-minute `pg_cron` →
`issue-studio-door-code` → TTLock keyboard password for the session window → emailed to the
customer, recorded in `emailed_to`/`emailed_at`.

The lock has been tested working from the crew app since the TTLock reset, and studio bookings go
through the *same* edge function and the same lock — so this half is ready. The only remaining
check is a live end-to-end once payments switch on: one real booking, paid, and confirm the code
email lands with the right window.

---

## 6. Env vars & setup

**Vercel (`unit20studios`, Production):**

| Var | For |
|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | the payment gate |
| `BOOKING_HOLD_MINUTES` | hold length (§8, Q2) |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TENANT_ID`, `XERO_ACCOUNT_CODE` | writing the books |
| `XERO_STRIPE_ACCOUNT_ID` | the clearing account payments post to (§8, Q1) |
| `XERO_WEBHOOK_KEY` | only if the manual-invoice path stays (§8, Q6) |

**Outside the repo:**

1. Stripe: confirm the All Ears account, get keys, add the webhook endpoint
   `https://studio.unit20.nz/api/webhooks/stripe` for `checkout.session.completed` and
   `checkout.session.expired`. Rehearse the whole flow in **test mode** first.
2. Xero: Custom Connection app, scopes `accounting.transactions` + `accounting.contacts`,
   authorised against All Ears. Confirm the revenue account code and that GST-on-income is
   `OUTPUT2` (15%) — the org is NZ/NZD/Pacific-Auckland, so that's expected.
3. Xero: identify the Stripe clearing account's `AccountID` (§8, Q1).

Note there is **no dependency on Xero for launch**. Steps 1 and the payment gate can ship and take
money correctly while the Xero write-up follows — the books can even be back-filled by the
reconciliation cron. That ordering removes the Custom Connection from the critical path.

---

## 7. Robustness checklist

- **Idempotency everywhere.** Stripe idempotency key on session create; webhook handlers keyed on
  session id; the paid flip guarded by `.neq('payment_status','paid')`; `invoiceBooking()` already
  claims `not_invoiced → creating` atomically. Stripe retries webhooks, so handlers *will* see
  duplicates.
- **Signature verification** on the Stripe webhook, over the raw body.
- **Never trust the redirect.** `success_url` can be opened by hand — always retrieve the session
  server-side before showing "confirmed".
- **Reconciliation cron both ways** (§4, item 8) so no single webhook is load-bearing.
- **Xero decoupled** from the customer's path entirely (§4, ordering rule).
- **Slot races** already handled by `create_booking_slot()`; two people cannot hold the same hour.
- **The expiry sweep must re-read `payment_status` in the same statement it releases on**, or it
  will eventually release a slot someone just paid for.
- **$0 bookings bypass the gate.** Banked-hours sessions are already $0 and `invoiceBooking()`
  skips them — they should confirm immediately with no Checkout session at all. The 10-hour pack
  is a $250 prepay and fits the gate perfectly.

---

## 8. Decisions needed before building

1. **Which Xero account do Stripe payments post to?** There's almost certainly a Stripe clearing
   account already, since Stripe is connected as a payment service. I need its `AccountID` (or its
   name, and I can find the id). Getting this wrong means the payout won't reconcile.
2. **Hold length.** Stripe's minimum is 30 minutes. Recommendation: **30** — long enough for a card
   payment, short enough that a Saturday-night slot isn't dead for an hour.
3. **Refund policy on customer cancellation.** Full refund up to N hours before, then nothing?
   This needs to be in the terms *before* the first prepayment, not after — it's the one item here
   that's a business decision rather than a technical one.
4. **Does prepayment skip the first-visit ID check?** Recommendation: no. Paid bookings go straight
   to `confirmed` and the door code issues; the ID check stays an on-arrival step.
5. **If Stripe is unreachable at booking time**, take the booking as pay-in-person or refuse it?
   Recommendation: take it — a booking you can chase beats a customer who bounced.
6. **Keep the Xero webhook and manual-invoice path?** It currently marks a booking paid when an
   invoice raised by hand in Xero gets paid. Useful for phone bookings and comps; costs nothing to
   keep. Recommendation: keep.

---

## 9. Suggested order of work

1. Stripe keys + webhook endpoint; build the gate and rehearse **entirely in test mode** —
   pay, abandon, expire, refund, replay a duplicate webhook.
2. Ship the gate with pay-in-person fallback. At this point the money is right and the door codes
   work; Xero is still manual, exactly as today.
3. Add the Xero write-up (`invoiceBooking()` + `applyInvoicePayment()`) behind the reconciliation
   cron, so a failure is a retry rather than an incident.
4. Back-fill any bookings taken between steps 2 and 3.
5. Refunds in admin + credit notes.
