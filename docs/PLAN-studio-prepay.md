# PLAN — pay before you book, then the door code issues itself

**Status:** planning doc — nothing here is built yet.
**Relationship to [`PLAN-xero-invoicing.md`](PLAN-xero-invoicing.md):** that plan designed
*invoice-then-pay* (owner approves → invoice emailed → customer pays whenever). Most of it is
**already built** (see §2). This doc covers the change of shape the new ask implies —
**payment gates the booking** — and the door-code half.

---

## 0. TL;DR

Two things are true and they make this much smaller than it looks:

1. **The door-code half is already done.** A trigger on `bookings` fires the moment
   `payment_status` becomes `'paid'`, enqueues a code for the exact session window, a
   once-a-minute cron mints it against the studio TTLock, and the function emails it to the
   customer. Nothing in this plan needs to build that — it needs to *cause* `paid` earlier.
2. **The Xero invoicing half is already written and switched off.** `invoiceBooking()`,
   contact lookup, invoice creation with an idempotency key, the online-invoice (pay-now) URL,
   and the payment webhook all exist. They no-op because five env vars aren't set in Vercel.

So the genuinely new work is one thing: **turn payment from something that happens after a
booking into the thing that creates it**, plus a hold-and-expire policy for the slot while the
customer is off paying.

**Recommendation:** ship the Xero-only version first (§4A) — it is days of work, not weeks,
because the pieces exist. Move to Stripe Checkout (§4B) only if drop-off proves the hosted-invoice
detour is costing bookings. **The one hard prerequisite either way is a payment service connected
to the All Ears Xero org** — without it the pay-now link is a view-only invoice and there is no
gate at all.

---

## 1. What the new ask changes

| | Old plan | This plan |
|---|---|---|
| Trigger | owner approves a request | customer pays |
| Booking at creation | held for the owner | held for the payer, with a deadline |
| Payment | invoice emailed, paid whenever | must clear before the slot is theirs |
| Unpaid after N | admin gets nagged | **slot is released** |
| Door code | on paid (already) | on paid (already, just sooner) |

The old flow's `pending_verification → confirmed` gate was about *the owner trusting the
customer*. The new gate is about *money landing*. They're different questions and both can exist:
prepayment doesn't prove someone is over 18 (§8, Q3).

---

## 2. What already exists — verified in the code, not assumed

| Piece | Where | State |
|---|---|---|
| Xero token (Custom Connection), contact find-or-create, invoice create, online-invoice URL, `emailInvoice` | `lib/xero.ts` | **written** |
| `invoiceBooking()` — atomic `not_invoiced → creating` claim, rollback on failure, skips $0 and already-invoiced | `lib/xero-booking.ts` | **written** |
| Admin: invoice on approval + resend action | `app/admin/actions.ts` | **wired** |
| Xero payment webhook → `payment_status='paid'` | `app/api/webhooks/xero/route.ts` | **written** |
| `paid` → access-instructions email (idempotent via `access_sent_at`) | `app/api/hooks/booking-paid/route.ts` | **live** |
| Invoice columns (`xero_invoice_id`, `online_invoice_url`, `invoice_status`, `paid_at`) | `lib/types.ts` + crew migration | **live** |
| Cleanup cron already refuses to sweep invoiced bookings | `app/api/cron/cleanup/route.ts` | **live** |
| **Door codes**: `studio_door_codes` + `paid` trigger + per-minute mint cron + code email | crew `0050`/`0051`/`0054`, `issue-studio-door-code` | **live** |
| Slot-conflict safety: `create_booking_slot()` is race-safe | studio `0002` | **live** |

Why it's all dormant: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_TENANT_ID`,
`XERO_WEBHOOK_KEY`, `XERO_ACCOUNT_CODE` are unset in Vercel, so `invoiceBooking()` returns
`{status:'skipped', reason:'xero_not_configured'}` on the first line.

---

## 3. The one real design decision

A Xero invoice is an accounting document with a payment link bolted on. A checkout is a funnel
that ends where you tell it to. Using the first as the second costs you four things:

- **No return URL.** Xero's hosted invoice page has nowhere to send the customer afterwards. They
  pay, then sit on a Xero page. Our confirmation screen can only say "we'll email you" (or poll).
- **"Paid" isn't guaranteed at the moment they leave.** The page also offers bank transfer, and
  partial payment is possible — so a customer can plausibly believe they've booked without the
  money having cleared.
- **Nothing holds the slot** — we have to build that ourselves either way, but with a checkout the
  hold is short and predictable (a session expiry), whereas an invoice invites "I'll pay tonight".
- **Refunds are a credit note**, not an API call against the original charge.

Against that, Xero-only has one enormous advantage: **it is almost entirely built**, it keeps one
system of record, and reconciliation is automatic because the invoice *is* the accounting entry.

| | **A. Xero online invoice** | **B. Stripe Checkout** |
|---|---|---|
| New code | small — reuse `invoiceBooking()`, redirect instead of email | new checkout route, webhook, refund path, then still create the Xero invoice |
| Customer journey | leaves site → Xero page → email confirms | leaves site → Stripe → **back to our confirmation page** |
| Confirmation latency | Xero webhook (seconds, occasionally longer) | `success_url` is immediate; webhook is the backstop |
| Guarantees payment before slot? | mostly — bank-transfer/partial escape hatches | yes — session is paid or it isn't |
| Refunds | credit note in Xero | API refund, then credit note in Xero |
| Extra cost | Custom Connection NZ$10/mo + Stripe fees (via Xero's payment service) | Stripe fees; Xero connection still wanted for the books |
| Schema | none — `payment_method 'stripe'` and `stripe_payment_intent_id` already exist unused | same columns, finally used |

**Recommendation: A first, B when it's earned.** A can be live in days and immediately delivers
what was asked — money up front, door code automatic. If the hosted-invoice detour visibly costs
conversions, B is a contained upgrade that reuses everything downstream of `payment_status`.

---

## 4. Architecture

### 4A. Phase 1 — Xero pay-now gates the booking

```
customer completes the form
  └─ POST /api/bookings  (unchanged: create_booking_slot() takes the slot atomically)
       status = pending_verification          ← this IS the hold; see below
       invoice_status = not_invoiced
  └─ invoiceBooking(id)                        ← existing; now called on CREATE, not approval
       Xero contact → AUTHORISED invoice (Idempotency-Key: booking:<id>:invoice)
       store xero_invoice_id, online_invoice_url, invoice_status = 'authorised'
  └─ respond { payUrl }  → client redirects to the Xero online invoice
                                    │
customer pays ──────────────────────┘
  └─ Xero webhook → payment_status = 'paid', paid_at            (built)
       ├─ booking-paid hook → status → confirmed, BookingConfirmed + ICS, access email  (built)
       └─ crew trigger → studio_door_codes row → per-minute cron → TTLock mint → code emailed  (built)

customer doesn't pay
  └─ new expiry cron → void invoice, release slot, refund banked hours, release discount code
```

**No new `status` value.** `bookings.status` is a CHECK-constrained text column on the *shared*
database, and the crew app reads it — widening it is a cross-app change for no gain. A hold is
already expressible: `status='pending_verification'` **and** `invoice_status='authorised'` **and**
`payment_status='unpaid'`. Availability already treats `pending_verification` as blocking, so the
slot is held the moment the row exists. Admin UI reads the pair and shows "awaiting payment".

**Work items**

1. `app/api/bookings/route.ts` — after `create_booking_slot()` succeeds, call `invoiceBooking()`
   and return `online_invoice_url` to the client. If Xero is unconfigured or the invoice fails,
   **fall back to today's pay-in-person behaviour** rather than failing the booking (§8, Q5).
2. `components/booking/BookingFlow.tsx` — on success with a `payUrl`, send the customer there;
   without one, the current confirmation page. The Review step's copy ("Payment happens in
   person") becomes conditional.
3. `app/(site)/studio/book/confirmation` — a "we're waiting on your payment" state that polls the
   booking (or just explains the email will arrive), because Xero can't return them here.
4. **Expiry cron** (new, or a branch of `cleanup`): holds older than `HOLD_MINUTES` and still
   unpaid → `voidInvoice()`, delete the booking, credit banked hours back (the pattern already
   exists in `cleanup`), release any redeemed discount code.
5. `lib/xero.ts` — add `voidInvoice()` (`POST /Invoices/{id}` with `Status: VOIDED`; only legal
   while no payment is applied).
6. Email: keep Xero's own invoice email as the fallback receipt, or build a branded
   `BookingHold` email carrying the pay link — one line either way (§8, Q4).
7. Guard the cleanup cron so it doesn't race the new expiry sweep.

### 4B. Phase 2 — Stripe Checkout (only if needed)

Swap step 1's redirect target for a Checkout Session (`success_url` →
`/studio/book/confirmation?session_id=...`, `cancel_url` back to the flow). On
`checkout.session.completed`: set `payment_method='stripe'`, `stripe_payment_intent_id`,
`payment_status='paid'` — and *everything downstream is unchanged*, because it all keys off
`payment_status`. Then call `invoiceBooking()` **after** payment and apply a Payment to the
invoice so Xero shows it settled and reconciles against the Stripe payout.

Both existing columns (`payment_method 'stripe'`, `stripe_payment_intent_id`) were designed for
this and have never been used.

---

## 5. Door codes — already automatic, but the lock changed

The chain is live and needs no new code:

`payment_status='paid'` → `trg_studio_booking_paid` (SECURITY DEFINER, failure-swallowing so it
can never roll back the payment) → `studio_door_codes` row `status='pending'` → `pg_cron` every
minute → `issue-studio-door-code` → TTLock keyboard password for the booking window → code
emailed to the customer, recorded in `emailed_to`/`emailed_at`.

**The TTLock reset is the live breakage.** Two things are now stale:

1. **`TTLOCK_STUDIO_LOCK_ID`** (a Supabase *edge-function secret*, not a Vercel var) points at a
   lock id that no longer exists. The function fails with
   `TTLock studio lock <id> not found on this account`. Fix: list the account's locks and set the
   new id — **or, if the account now has exactly one lock, unset the secret entirely**: the
   function already falls back to "the only lock" and that's one fewer thing to drift.
2. **Existing rows carry dead `ttlock_keyboard_pwd_id`s.** Any code minted against the old lock is
   gone from the hardware but still reads `active` in the table, and `attempts` may have been
   burned on failed rows (the cron bounds retries by it). For every future booking, reset the row
   so the cron re-mints and re-sends:

   ```sql
   update studio_door_codes
      set status = 'pending', code = null, ttlock_keyboard_pwd_id = null,
          attempts = 0, last_error = null, emailed_at = null, emailed_to = null
    where valid_to > now()
      and status in ('active', 'failed', 'pending');
   ```

   Run it *after* the lock id is corrected, or the retries just burn again. Customers with a
   future booking get a fresh code email; nulling `emailed_at` is what allows the resend.

Do this **before** switching on prepay — otherwise the first prepaid customer is the one who
discovers the lock is wrong.

---

## 6. Data model

Phase 1 needs **no new columns and no new status values** — that's the point of using
`invoice_status` as the hold marker. Only two config values are new:

- `HOLD_MINUTES` — how long a slot is held unpaid (proposal: 60; §8, Q1).
- `XERO_ACCOUNT_CODE` — already referenced by `invoiceBooking()`, still unset.

Phase 2 (Stripe) adds nothing either: `payment_method` and `stripe_payment_intent_id` exist.

---

## 7. Env vars & external setup

**Vercel (`unit20studios`, Production):** `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`,
`XERO_TENANT_ID`, `XERO_WEBHOOK_KEY`, `XERO_ACCOUNT_CODE`, optional
`XERO_BRANDING_THEME_ID`, new `BOOKING_HOLD_MINUTES`.

**Supabase edge-function secrets:** corrected `TTLOCK_STUDIO_LOCK_ID` (or removed — §5).

**Outside the repo, in order:**

1. **Connect a payment service (Stripe) to the All Ears Xero org and enable "Pay Invoice Online"
   on the branding theme.** *Nothing else in this plan works without this* — the pay-now link is
   view-only until it's done, and a view-only invoice is not a gate.
2. Xero developer portal: Custom Connection app, scopes `accounting.transactions` +
   `accounting.contacts`, authorised against All Ears (starts the NZ$10/mo add-on).
3. Webhook → `https://studio.unit20.nz/api/webhooks/xero`, saved **after** the env vars are live
   so the intent-to-receive handshake passes.
4. Confirm the revenue account code and that GST-on-income is `OUTPUT2` (15%).
5. Fix the TTLock lock id and reset stale door-code rows (§5).

You now have the Xero MCP connected locally, which makes steps 4 and the first end-to-end test
much easier to verify without clicking through the Xero UI.

---

## 8. Decisions needed before building

1. **Hold length.** How long is a slot held while someone pays? 60 minutes is long enough for a
   bank transfer to be *started* but not to clear. Shorter (15 min) suits card payment and
   protects the calendar. Recommendation: **60 min**, and treat bank transfer as "you'll get an
   email when it lands, the slot may be gone".
2. **Does prepay replace pay-in-person entirely, or sit alongside it?** Recommendation: prepay
   becomes the default path and pay-in-person survives as the fallback when Xero is unreachable
   (§4A item 1) and for admin quick-books.
3. **Does prepayment skip the ID check?** It shouldn't — money isn't age. Recommendation: paid
   bookings go straight to `confirmed` (the slot is theirs, the door code issues), and the
   first-visit ID check stays an on-arrival step rather than a booking gate.
4. **Whose email carries the pay link** — Xero's invoice email (built, off-brand, second sender)
   or a branded `BookingHold` email from us? The redirect means the email is only a fallback, so
   Xero's is defensible for Phase 1.
5. **If Xero is down at booking time**, do we take the booking as pay-in-person or refuse it?
   Recommendation: take it — a booking you can chase beats a customer who bounced.
6. **Refund policy on customer cancellation** once prepaid — full refund up to N hours, then
   nothing? This is a business rule, not a technical one, and it needs to be in the terms before
   the first prepayment, not after.
7. **The 10-hour pack** is already a $250 prepay and fits perfectly. **Banked-hours bookings are
   $0** and `invoiceBooking()` skips them — they should bypass the gate entirely and confirm
   immediately. Confirm that's intended.

---

## 9. Risks

- **View-only invoice.** If the payment service isn't connected, customers reach a page that can't
  take money and the booking silently rots. Make step 7.1 a hard gate on shipping.
- **Webhook is the only confirmation trigger.** If Xero webhook delivery breaks, paid bookings sit
  unconfirmed and no door code is minted. Mitigation: a daily reconciliation sweep over
  `invoice_status='authorised'` rows (`GET /Invoices?IDs=…`) — cheap, and the manual "mark paid"
  admin path already produces every side effect correctly.
- **Expiry cron deletes a booking someone just paid for.** The sweep must re-read
  `payment_status` inside the same statement it deletes on, and must never void an invoice with a
  payment applied (Xero refuses, which is a useful second line of defence).
- **No Xero sandbox for a live Custom Connection.** First tests hit the real All Ears org — use a
  $1 invoice and void it.
- **Double-booking during the hold** is already handled: `create_booking_slot()` takes the slot
  before the invoice exists, so two people can't hold the same hour.
- **Shared DB.** Everything here stays inside columns the studio app already owns, except the
  door-code table, which is the crew app's and needs no change.

---

## 10. Suggested order of work

1. Fix the TTLock lock id + reset stale door-code rows (§5). Independent of everything else, and
   currently broken.
2. Connect Stripe to the Xero org; enable Pay Invoice Online (§7.1).
3. Set the five Xero env vars; verify with one $1 invoice end-to-end (invoice → pay → webhook →
   `paid` → confirmed email → door code minted and emailed). **This alone proves the whole chain
   without a line of new code.**
4. Move `invoiceBooking()` from approval to booking creation; return + redirect to the pay link.
5. Expiry cron + `voidInvoice()`.
6. Confirmation-page "awaiting payment" state.
7. Watch drop-off for a few weeks; decide on Stripe Checkout (§4B).
