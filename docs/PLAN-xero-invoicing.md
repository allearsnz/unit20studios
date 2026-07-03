# PLAN — Xero invoicing for studio bookings

**Status:** planning doc — nothing here is built yet.
**Supersedes:** `/XERO-TODO.md` (the "manual invoicing for now" note). That file now points here.
**Scope:** auto-generate invoices in the **All Ears** Xero org for studio bookings, email the
customer a **pay-now link** (Xero online invoice), confirm the booking automatically when Xero
reports payment, and let the owner approve bookings **from the notification email** or from
`/admin`.

---

## 1. The desired flow (user's words, distilled)

1. Customer requests to book → booking created as **pending**.
2. Owner **sees it and approves** — ideally one tap from the notification email, or from `/admin`.
3. On approval → an **invoice is created in Xero**, customer is emailed it with a **pay-now link**.
4. Customer **pays** → Xero webhooks us → booking **confirmed** → customer gets the rest
   (access instructions etc.).

---

## 2. What already exists (build on it, don't reinvent)

| Piece | File | State |
|---|---|---|
| Xero client + webhook signature helper | `lib/xero.ts` | Custom-Connection token fetch (read-only scope), `fetchXeroInvoice`, `isInvoiceFullyPaid`, `verifyXeroSignature` |
| Xero webhook receiver | `app/api/webhooks/xero/route.ts` | Verifies HMAC over raw body, handles intent-to-receive, matches paid invoices by `Reference` = `friendly_id`, flips `payment_status='paid'` |
| Post-payment hook | `app/api/hooks/booking-paid/route.ts` | Supabase DB webhook target; on `payment_status` → `paid` sends access instructions (idempotent via `access_sent_at` claim in `lib/notifications.ts`) |
| Booking creation | `app/api/bookings/route.ts` | New customers → `pending_verification`; verified repeat customers → `confirmed` immediately. Prices via `lib/pricing.ts` (all ex-GST cents) |
| Admin actions | `app/admin/actions.ts` | `setBookingStatus` (atomic pending→confirmed claim + BookingConfirmed email), `verifyCustomer`, `setPaymentStatus`, `cancelBooking` — all gated by `assertAdmin()` (ADMIN_EMAIL) |
| Emails | `lib/notifications.ts`, `emails/*` | Branded React emails: BookingReceivedNewCustomer, BookingConfirmed (+ICS), BookingAccessInstructions, BookingReminder, BookingCancelled. Admin notify is plain text (`notifyAdmin`) |
| Crons | `vercel.json` + `app/api/cron/*` | Daily `reminders` (pre-session), `post-session`, `cleanup` (**deletes `pending_verification` bookings older than 72 h** — interacts with invoicing, see §8) |
| Pricing | `lib/pricing.ts` | 1 h $50 / 2 h $80 / weekday-daytime 2 h $60 / 10 h pack $250 / group >4 surcharge (+$20 1 h, +$30 2 h) — all **ex-GST**, NZ GST 15% (`GST_RATE`) |
| DB | shared Supabase project with the crew app | `bookings.xero_invoice_id` **already exists** (crew migration `0027_studio_bridge.sql`). Status/payment enums are `text` + CHECK constraints (`0001_init.sql`) |

Key existing idempotency patterns to reuse:
- **Atomic claim** on `pending_verification → confirmed` in `setBookingStatus` (exactly-once
  BookingConfirmed email).
- **Atomic claim** on `access_sent_at` in `sendAccessInstructions` (exactly-once access email,
  rollback on send failure).
- Webhook only flips rows that aren't already paid (`.neq("payment_status", "paid")`).

---

## 3. Xero API — verified against live docs (July 2026)

### 3.1 Auth: Custom Connection (recommended) vs standard OAuth2

**Recommendation: Custom Connection** — it is exactly what the existing env vars
(`XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / `XERO_TENANT_ID`) and `lib/xero.ts` were written for.

- **Grant:** OAuth2 `client_credentials` — machine-to-machine, **no user consent screen, no
  refresh-token dance, no token storage**.
  Docs: <https://developer.xero.com/documentation/guides/oauth2/custom-connections/> and
  <https://developer.xero.com/documentation/guides/oauth2/client-credentials/>
- **Token endpoint:** `POST https://identity.xero.com/connect/token` with HTTP Basic auth
  (`client_id:client_secret`), body `grant_type=client_credentials&scope=...`.
- **Token lifetime:** ~**30 minutes**, no refresh token — just request a fresh one whenever needed.
  Our call volume is tiny (a handful per day), so the existing **fetch-a-token-per-call** approach
  in `lib/xero.ts` stays; add an optional in-memory cache later only if it ever matters.
- **Scopes** are selected when the Custom Connection app is created in the developer portal and
  must also be requested in the token call. We need:
  - `accounting.transactions` (create + read invoices; the current code requests only
    `accounting.transactions.read` — **must be broadened**),
  - `accounting.contacts` (find/create the customer contact),
  - `accounting.settings.read` only if we later read branding themes / tax rates / account codes
    via API (optional; not needed for MVP if the account code is configured by env var).
- **One organisation per connection** — the connection is authorised against the All Ears org;
  its tenant id is `XERO_TENANT_ID`. The existing code sends the `Xero-tenant-id` header on API
  calls; keep doing so (explicit and correct).
- **Cost / availability:** Custom Connections are a **paid Xero add-on, billed per connection,
  monthly** — currently **NZ$10/month ex GST** (AU$10 inc GST / £5 / US$5), available for AU, NZ,
  UK and US organisations. Purchased/authorised by the Xero org subscriber.
  Docs: <https://developer.xero.com/pricing> and
  <https://developer.xero.com/faq/custom-integration>
  Note: Custom Connections kept their own commercial terms under Xero's 2026 tiered API pricing.

Standard OAuth2 (authorisation-code) is the fallback if the add-on cost is refused: it's free but
needs a one-time browser consent, offline_access refresh tokens, **token storage + rotation**
(refresh tokens are single-use), and re-consent if the token chain ever breaks. That's meaningful
extra moving parts for a single-org integration — not recommended here.

### 3.2 Accounting API — contacts and invoices

Base: `https://api.xero.com/api.xro/2.0`, headers `Authorization: Bearer`, `Xero-tenant-id`,
`Accept: application/json`.

- **Find contact by email:**
  `GET /Contacts?where=EmailAddress=="jane@example.com"` — simple `==` filters on EmailAddress are
  in Xero's optimised set; keep queries simple, lowercase our stored email, and escape quotes.
  Create if missing: `POST /Contacts` with `{ Name, EmailAddress, Phones? }`.
  Docs: <https://developer.xero.com/documentation/api/accounting/contacts>
  Gotcha: contact **Name must be unique** in Xero — if a name collision occurs on create, fall
  back to `Name: "Jane Smith (jane@example.com)"` or reuse the existing contact by email.
- **Create invoice:** `POST /Invoices` with:
  ```jsonc
  {
    "Type": "ACCREC",
    "Contact": { "ContactID": "..." },
    "Status": "AUTHORISED",          // create approved directly — no DRAFT step
    "LineAmountTypes": "Exclusive",  // our prices are ex-GST
    "Reference": "U20-2026-0042",    // booking friendly_id (webhook fallback match)
    "Date": "2026-07-03",
    "DueDate": "2026-07-08",         // policy: see §8
    "LineItems": [
      { "Description": "Studio session — Sat 11 Jul, 7–9pm (2h)",
        "Quantity": 1, "UnitAmount": 80.00,
        "AccountCode": "<XERO_ACCOUNT_CODE>", "TaxType": "OUTPUT2" },
      { "Description": "Group surcharge (5–8 people)",
        "Quantity": 1, "UnitAmount": 30.00,
        "AccountCode": "<XERO_ACCOUNT_CODE>", "TaxType": "OUTPUT2" }
    ],
    "BrandingThemeID": "<optional — theme with online payments enabled>"
  }
  ```
  Docs: <https://developer.xero.com/documentation/api/accounting/invoices>
  - `TaxType: "OUTPUT2"` is NZ **15% GST on income**. Verify once against the org
    (`GET /TaxRates`) during setup rather than trusting the constant:
    <https://developer.xero.com/documentation/api/accounting/taxrates> /
    <https://developer.xero.com/documentation/api/accounting/types>
  - `UnitAmount` is dollars (decimal), our DB stores ex-GST **cents** — divide by 100.
  - **Idempotency:** the Accounting API supports an **`Idempotency-Key` header (≤128 chars)** on
    POST/PUT — send `booking:<booking.id>:invoice` so a retried create can't double-invoice.
    Docs: <https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/>
  - Set `SentToContact: true` (only valid on approved invoices) so the invoice counts as "sent" —
    a prerequisite for Xero's own invoice reminders (§8).
- **Rate limits:** 60 calls/min and 5 000/day per org, 5 concurrent, 429 + `Retry-After` on
  breach. Irrelevant at studio volume but the webhook loop should stay sequential (it already is).
  Docs: <https://developer.xero.com/documentation/best-practices/api-call-efficiencies/rate-limits>

### 3.3 The pay-now link (online invoice)

- `GET /Invoices/{InvoiceID}/OnlineInvoice` → `{ "OnlineInvoices": [{ "OnlineInvoiceUrl": "https://in.xero.com/..." }] }`.
  Works for **ACCREC** invoices that are **not DRAFT** — another reason to create as AUTHORISED.
  Docs: <https://developer.xero.com/documentation/api/accounting/invoices> (Retrieving the online
  invoice URL section).
- **Critical prerequisite for an actual "Pay now" button:** the link always shows the invoice, but
  it only takes payment if a **payment service (e.g. Stripe or GoCardless) is connected to the
  Xero org and enabled on the invoice's branding theme** ("Pay Invoice Online" is a per-branding-
  theme setting). Without that, customers see a view-only invoice and we're back to bank-transfer
  instructions.
  Docs: <https://central.xero.com/s/article/About-payment-services> and
  <https://developer.xero.com/documentation/api/accounting/paymentservices>
  → **Setup task (in Xero, not code):** connect Stripe to the All Ears org, enable Pay Invoice
  Online on the branding theme we'll use, optionally pass that theme's `BrandingThemeID` on create.
  Note Stripe's per-transaction fees apply on top of the $10/m Custom Connection fee.

### 3.4 Webhooks

Docs: <https://developer.xero.com/documentation/guides/webhooks/overview/>

- Configured per app in the developer portal: subscribe to the **INVOICE** category (CONTACT also
  exists; we don't need it), delivery URL `https://studio.unit20.nz/api/webhooks/xero`, and Xero
  issues a **webhook signing key** → env `XERO_WEBHOOK_KEY`.
- **Signature:** `x-xero-signature` = base64(HMAC-SHA256(raw body, signing key)). Must be computed
  over the **raw, unparsed body**; respond **200** on match, **401** on mismatch.
  `lib/xero.ts#verifyXeroSignature` + the raw `req.text()` handling in the route already do this
  correctly (constant-time compare included).
- **Intent to Receive:** on save, Xero sends probes (correctly and incorrectly signed, empty
  `events`) and expects 200/401 with an empty-ish body, responding **within 5 seconds**. The
  existing route passes this by design.
- **What fires on payment:** there is **no dedicated "invoice paid" event** — applying a payment
  (including a Stripe online-invoice payment) produces an `INVOICE` / `UPDATE` event. The payload
  carries only `resourceId` + event metadata, **not** the changed fields, so the receiver must
  `GET /Invoices/{resourceId}` and check `Status == "PAID"` / `AmountDue <= 0` — exactly what
  `fetchXeroInvoice` + `isInvoiceFullyPaid` do.
- **Gotchas:** events arrive batched and can be redelivered (retries with growing intervals on
  non-200) — handlers must be idempotent (ours is); respond fast (5 s) — our per-event GETs are
  fine at studio volume, but never add slow work (email sending etc.) to this route: state changes
  here, side effects via the DB webhook (§4).

---

## 4. Architecture

### 4.1 Modules

```
lib/xero.ts                      ← extend (single home for all Xero API code)
  getAccessToken(scope)            broaden scope: "accounting.transactions accounting.contacts"
  verifyXeroSignature(...)         (exists, unchanged)
  fetchXeroInvoice(id)             (exists, unchanged)
  isInvoiceFullyPaid(inv)          (exists, unchanged)
  findOrCreateContact({name,email,phone}) → ContactID          (new)
  createBookingInvoice({booking,customer,lines}) → XeroInvoice (new; Idempotency-Key)
  getOnlineInvoiceUrl(invoiceId) → string                      (new)
  voidInvoice(invoiceId)                                       (new, Phase 3)

lib/xero-booking.ts (new)        ← the one orchestration entrypoint
  invoiceBooking(bookingId)        claim → contact → invoice → url → persist → email
                                   (called from admin action AND email-approval endpoint)

lib/booking-lines.ts (new, or in lib/pricing.ts)
  bookingInvoiceLines(booking, tier) → line items mirroring calcBookingPriceCents
  (base session line + optional surcharge line; pack = one $250 pack line + note)

lib/admin-action-token.ts (new)  ← signed one-tap approval links (§6)

app/admin/actions.ts             ← extend: approveBooking(id, { invoice: boolean })
app/admin/approve/[token]/page.tsx  (new, Phase 2 — confirm page)
app/api/webhooks/xero/route.ts   ← extend matching (xero_invoice_id first), stamp paid_at
app/api/hooks/booking-paid/route.ts ← extend: also confirm + BookingConfirmed (§5 step 6)
app/api/cron/cleanup/route.ts    ← guard: never delete invoiced bookings (§8)
emails/BookingInvoice.tsx        (new — branded pay-now email)
emails/AdminBookingAction.tsx    (new, Phase 2 — branded admin email with action buttons)
```

Auth stays **stateless**: no token table, no refresh logic — `getAccessToken()` per operation
(one token comfortably covers the 2–4 API calls of a single approval).

### 4.2 Request flow per operation

- **Approve & invoice** (admin action or email link): 1 token fetch → find/create contact →
  POST invoice → GET online-invoice URL → DB update → Resend email. ~4 Xero calls, well under
  limits; wrap in the `invoice_status` claim (§5) so it runs at most once per booking.
- **Webhook**: verify → per INVOICE event: 1 token fetch + 1 invoice GET → DB update. No emails
  from this route (the DB webhook does side effects), keeping us inside the 5 s budget.

---

## 5. End-to-end flow (mapped onto the existing lifecycle)

```
Customer submits booking (POST /api/bookings)
        │
        ├─ verified repeat customer → status='confirmed' at creation (auto-confirm path)
        │     └─ invoicing for these: admin-triggered from the booking page (MVP; see §7)
        └─ new customer → status='pending_verification'
                │
                ▼
  Admin notified (email w/ action links [Phase 2] + /admin/bookings/{id})
                │
     ┌──────────┴─────────────────┐
     ▼                            ▼
 APPROVE & INVOICE           APPROVE — PAY IN PERSON (today's path, unchanged)
     │                            │
  verifyCustomer()             verifyCustomer()
  claim: invoice_status        setBookingStatus('confirmed')
   'not_invoiced'→'creating'    → BookingConfirmed (+ICS)
  findOrCreateContact()         → access email when admin marks paid
  POST /Invoices                  (or comped) — unchanged
   (ACCREC, AUTHORISED,
    Reference=friendly_id,
    Idempotency-Key,
    SentToContact=true)
  GET .../OnlineInvoice
  persist: xero_invoice_id, xero_contact_id,
   online_invoice_url, invoiced_at,
   invoice_status='authorised'
  send BookingInvoice email (branded, pay-now button)
   • booking stays 'pending_verification' — it is
     "approved, awaiting payment" (derived label in admin UI)
     │
     ▼
 Customer opens online invoice → pays by card (Stripe behind Xero)
     │
     ▼
 Xero applies the payment → invoice Status becomes PAID
     │
     ▼
 INVOICE/UPDATE webhook → POST /api/webhooks/xero
   verify x-xero-signature over raw body (401 on fail)
   GET /Invoices/{resourceId} → isInvoiceFullyPaid?
   match booking: xero_invoice_id == resourceId  (primary, new)
                  else Reference == friendly_id  (fallback, keeps manual invoices working)
   UPDATE bookings SET payment_status='paid', invoice_status='paid',
                       paid_at=now()  WHERE ... AND payment_status <> 'paid'
     │
     ▼
 Supabase DB webhook (bookings UPDATE) → POST /api/hooks/booking-paid
   (Bearer BOOKING_HOOK_SECRET; fires on not-paid → paid transition)
   1. atomic claim 'pending_verification' → 'confirmed'
        won → send BookingConfirmed (+ICS)          ← NEW behaviour
        lost/already confirmed (in-person path, manual mark-paid) → skip
   2. sendAccessInstructions()  — existing idempotent claim on access_sent_at
```

### Idempotency inventory (no double-invoice, no double-confirm, no double-email)

| Risk | Guard |
|---|---|
| Double-tap "Approve & invoice" / concurrent admin + email link | Atomic DB claim: `UPDATE bookings SET invoice_status='creating' WHERE id=? AND invoice_status='not_invoiced'` — loser no-ops. On Xero failure, roll the claim back to `'not_invoiced'` (mirror of the `access_sent_at` rollback pattern) |
| Retry after network blip mid-create | Xero `Idempotency-Key` = `booking:<id>:invoice` — Xero returns the original invoice instead of a duplicate |
| Webhook redelivery / batched duplicates | `payment_status <> 'paid'` guard (exists) + DB webhook requires a not-paid→paid *transition* (exists) |
| Double BookingConfirmed | Atomic `pending_verification → confirmed` claim (pattern already in `setBookingStatus`; reuse in the booking-paid hook) |
| Double access email | `access_sent_at` claim (exists, untouched) |
| Invoice created but email send fails | `invoice_status='authorised'` is already persisted; admin booking page gets a "Resend invoice email" button (reuses stored `online_invoice_url`) |

---

## 6. Approve-from-email (Phase 2)

One-tap approval from the admin notification email, usable on a phone with no login. Same spirit
as the crew repo's job-pack/calendar share tokens (unguessable capability links consumed outside
RLS), but **stateless**: HMAC-signed, expiring, single-action — no token table needed.

### Token format

```
payload = base64url(JSON: { v: 1, bid: <booking uuid>, act: "approve_invoice" | "approve_inperson", exp: <unix seconds> })
token   = payload + "." + base64url(HMAC-SHA256(ADMIN_ACTION_SECRET, payload))
```

- `ADMIN_ACTION_SECRET`: new 32+-byte random secret (Vercel env). Independent from Supabase keys
  so it can be rotated without touching anything else (rotation instantly invalidates all
  outstanding links — acceptable: admin falls back to `/admin`).
- `exp` = issue + **72 h**, matching the pending-booking cleanup window.
- Scope is **one action on one booking** — a leaked link cannot read data, list bookings, or grant
  a session. It can only approve that specific booking, once (server-side claims make replays
  no-ops).

### Endpoint design — two-step, never act on GET

Email scanners and link-preview bots **prefetch GETs**; a booking must never get approved by
Outlook SafeLinks. So:

1. `GET /admin/approve/[token]` (page, no auth): verify signature (timing-safe) + expiry + booking
   still actionable → render a minimal summary (who/when/price/act) with a single **confirm
   button** (form POST). Invalid/expired/already-handled → friendly dead-end page pointing at
   `/admin`.
2. `POST` (server action on that page): re-verify token, then run the exact same code paths as the
   admin UI (`verifyCustomer` + `approveBooking(id, { invoice })`). All the §5 claims apply, so a
   double-submit or a replayed link is harmless.

### Email

Upgrade the plain-text `notifyAdmin` booking alert to a branded `AdminBookingAction` email:
booking summary + three links — **Approve & send invoice**, **Approve — pay in person** (both
signed tokens), **Review in admin** (plain `/admin/bookings/{id}`). Decline/cancel stays in the
admin UI (destructive; keep it behind login).

Security notes: HTTPS-only links; tokens appear in email bodies and possibly mail-provider logs —
mitigated by short expiry, single-action scope, signature over the exact payload, and idempotent
handlers. No PII in the token itself (just a UUID). The page should set `noindex`.

---

## 7. Data model

### New `bookings` columns (all additive, nullable/defaulted)

```sql
alter table bookings add column if not exists xero_invoice_id    text;         -- EXISTS (crew 0027) — keep idempotent
alter table bookings add column if not exists xero_contact_id    text;
alter table bookings add column if not exists invoice_status     text not null default 'not_invoiced'
  check (invoice_status in ('not_invoiced','creating','authorised','paid','voided'));
alter table bookings add column if not exists online_invoice_url text;
alter table bookings add column if not exists invoiced_at        timestamptz;
alter table bookings add column if not exists paid_at            timestamptz;

create index if not exists bookings_xero_invoice_id_idx
  on bookings (xero_invoice_id) where xero_invoice_id is not null;
```

- `invoice_status` is the invoicing state machine (`creating` is the transient claim state);
  booking `status` and `payment_status` keep their existing meanings. **No new booking status** —
  "approved, awaiting payment" is *derived* (`status='pending_verification' AND
  invoice_status='authorised'`) and rendered as a label in admin/emails. This avoids touching the
  `status` CHECK constraint that the crew app also reads (Board `studio_board_cards`, Studio tab).
- `payment_method` currently checks `('in_person','stripe')`. Payments via the online invoice are
  Stripe-behind-Xero, so recording them as `'stripe'` is honest and needs no constraint change;
  if a distinct `'xero'` value is preferred, the migration can widen the CHECK (cheap, but touches
  crew-visible values — decide in review).
- No token storage of any kind: client-credentials auth is stateless, approval links are
  HMAC-verified.
- Mirror the new fields in `lib/types.ts` (`Booking`) and add an `InvoiceStatus` union.

### Shared-DB caveat — where the migration lives

The studio tables live in the **shared Supabase project managed by the crew repo's migration
chain** (`all-ears-crew/supabase/migrations`, currently at `0042`; studio-affecting changes are
already done there — `0027_studio_bridge.sql`, `0029_studio_group_capacity_8.sql`,
`0041_studio_pricing_2h_80.sql`). Recommended, matching the established convention:

1. **Authoritative migration:** `all-ears-crew/supabase/migrations/0043_studio_xero_invoicing.sql`
   (additive, `if not exists` throughout, rollback comment at the bottom — house style).
2. **Mirror copy for reference:** `unit20studios/supabase/migrations/0008_xero_invoicing.sql`
   with a header comment "mirror of crew 0043 — applied via the crew chain; do not run separately"
   (same pattern as studio `0006`/`0007` ↔ crew `0041`/`0029`).
3. Nothing in the crew app needs the new columns (its RLS read policies are table-wide), but the
   crew Studio tab could later surface `invoice_status` for free.

---

## 8. Coexistence with pay-in-person, unpaid handling, edge cases

### Invoice now vs pay in person — an admin choice at approval

Approval becomes a **two-button decision** (admin UI and Phase-2 email):

| | Approve & invoice | Approve — pay in person |
|---|---|---|
| Customer verification | `verifyCustomer()` | `verifyCustomer()` |
| Booking status | stays `pending_verification` (shown as "invoiced — awaiting payment") | → `confirmed` immediately (today's behaviour) |
| Customer email | **BookingInvoice** (pay-now link, due date, booking summary) | **BookingConfirmed** (+ICS) |
| Confirmation trigger | Xero webhook: paid → confirmed + BookingConfirmed + access email | already confirmed |
| Access instructions | automatic on webhook `paid` | when admin marks paid / comped (existing manual flow, unchanged) |

- **Verified repeat customers** auto-confirm at creation and never hit the approval gate. MVP: the
  admin booking page gets a **"Create & send Xero invoice"** button usable on any
  confirmed-but-unpaid booking (same `invoiceBooking()` entrypoint; booking is already confirmed
  so payment just flips `payment_status` + access email). Auto-invoicing these at creation is a
  Phase-3 toggle, pending the user's call (§10).
- **Cancelling an invoiced booking:** `cancelBooking` should warn if `invoice_status='authorised'`
  and (Phase 3) void the Xero invoice (`Status: VOIDED` — only possible while no payment is
  applied) and set `invoice_status='voided'`. MVP: warn + link to the invoice in Xero for manual
  voiding.
- **Manual invoices keep working:** the webhook's `Reference == friendly_id` fallback match stays,
  so an invoice raised by hand in Xero (with the friendly id as reference) still auto-marks the
  booking paid.

### Unpaid handling

- **Due-date policy (decide with user):** proposal — `DueDate` = earlier of (issue date + 5 days,
  the day before the session). Payment before the session is the point of the exercise.
- **Reminders — use Xero's own first** (zero code): org-level invoice reminders (up to 5;
  defaults 7/14/21 days overdue; can also fire *before* due date; can include the online-invoice
  link; require the invoice "marked as sent" — hence `SentToContact: true` at create).
  Docs: <https://central.xero.com/s/article/Set-up-invoice-reminders>,
  <https://central.xero.com/s/article/How-invoice-reminders-work>
  Caveat: they're org-wide — if All Ears invoices other customers from the same org, turning them
  on affects everyone. If that's a problem → **our own cron nudge** (Phase 3): extend
  `app/api/cron/reminders` — bookings with `invoice_status='authorised'`, unpaid, session within
  48 h → resend BookingInvoice (once, stamped, reusing the stored `online_invoice_url`).
- **Expiry of unpaid pending bookings — cleanup-cron conflict (MVP must fix):**
  `app/api/cron/cleanup` currently **deletes** `pending_verification` bookings older than 72 h —
  which would silently delete an invoiced-awaiting-payment booking while its Xero invoice lives
  on. Change: exclude `invoice_status <> 'not_invoiced'` from deletion. Policy for invoiced
  bookings instead: if still unpaid 24 h before the session (or 7 days after invoicing for
  far-future bookings), **notify the admin** — don't auto-cancel in MVP; Phase 3 can add
  auto-void + cancel + slot release once trust is established.

---

## 9. Env vars & external setup

### Vercel (`unit20studios` project — Production, + Preview if used)

| Var | Purpose | New? |
|---|---|---|
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` | Custom Connection credentials | referenced in code already; **not yet set** |
| `XERO_TENANT_ID` | All Ears org tenant id (from `GET https://api.xero.com/connections` once, or the portal) | same |
| `XERO_WEBHOOK_KEY` | webhook signing key from the developer portal | same |
| `XERO_ACCOUNT_CODE` | revenue account for studio income (e.g. a "Studio hire" sales account — confirm code with user, §10) | **new** |
| `XERO_BRANDING_THEME_ID` | optional — branding theme with Pay Invoice Online enabled | **new, optional** |
| `ADMIN_ACTION_SECRET` | HMAC key for approve-from-email links (Phase 2) | **new** |

Already present and unchanged: `RESEND_*`, `ADMIN_EMAIL`, `BOOKING_HOOK_SECRET`, `CRON_SECRET`,
Supabase keys.

### One-time setup outside this repo

1. **Xero developer portal:** create the Custom Connection app; scopes `accounting.transactions`,
   `accounting.contacts`; org subscriber authorises it against **All Ears** (starts the NZ$10/m
   add-on); copy client id/secret.
2. **Webhooks (portal):** subscribe to INVOICE events → `https://studio.unit20.nz/api/webhooks/xero`;
   env vars + deploy must be live **before** saving so the Intent-to-Receive handshake passes;
   copy signing key.
3. **Xero org:** connect **Stripe** (or chosen provider) as a payment service; enable **Pay
   Invoice Online** on the branding theme; confirm the GST-on-income tax rate and the revenue
   account code; (optional) configure invoice reminders.
4. **Supabase:** apply crew migration `0043`; confirm the existing bookings-UPDATE Database
   Webhook → `/api/hooks/booking-paid` is configured with `BOOKING_HOOK_SECRET`.

---

## 10. Phased roadmap (each phase independently shippable)

### Phase 1 — MVP: approve in admin → invoice + pay-link email → webhook confirms
1. Crew migration `0043_studio_xero_invoicing.sql` + studio mirror `0008` + `lib/types.ts`.
2. `lib/xero.ts`: broaden token scope; add `findOrCreateContact`, `createBookingInvoice`
   (Idempotency-Key, `SentToContact`), `getOnlineInvoiceUrl`.
3. `lib/xero-booking.ts` `invoiceBooking()` orchestration with the `invoice_status` claim/rollback.
4. `lib/booking-lines.ts`: line items mirroring `calcBookingPriceCents` (session + surcharge;
   pack as one line), `TaxType OUTPUT2`, `LineAmountTypes Exclusive`.
5. `emails/BookingInvoice.tsx` (branded, pay-now button, due date) + "Resend invoice email" admin
   action.
6. `app/admin/actions.ts` `approveBooking(id, { invoice })` + two-button approval UI on the
   booking page; "Create & send Xero invoice" button for already-confirmed unpaid bookings.
7. Webhook route: match by `xero_invoice_id` first (Reference fallback), stamp
   `invoice_status='paid'`, `paid_at`.
8. `booking-paid` hook: atomic pending→confirmed claim + BookingConfirmed send, then existing
   access-instructions call.
9. Cleanup cron guard (`invoice_status = 'not_invoiced'` only).
10. Env vars, Xero portal + org setup, end-to-end test with a $1 real invoice (Xero has no
    sandbox for Custom Connections against the live org — use a low-value real invoice, then void).

### Phase 2 — approve from email
1. `lib/admin-action-token.ts` (sign/verify, exp, timing-safe).
2. `GET /admin/approve/[token]` confirm page + POST server action (never act on GET).
3. `emails/AdminBookingAction.tsx` branded admin notification with the two approve buttons +
   review link; swap `notifyAdmin` call in `sendBookingCreatedEmails` to it.
4. `ADMIN_ACTION_SECRET` env.

### Phase 3 — reminders & polish
1. Unpaid-invoice nudges: Xero reminders (org decision) and/or cron resend 48 h pre-session.
2. Unpaid escalation: admin alert at T-24 h; optional auto-void + cancel + slot release.
3. `voidInvoice()` wired into `cancelBooking` for authorised-unpaid invoices.
4. Invoice status surfaced on admin list/detail (and optionally the crew Studio tab).
5. Optional: auto-invoice verified repeat customers at booking creation (toggle).
6. Optional: in-memory token cache; `waitUntil`-deferred webhook processing if volume ever grows.

---

## 11. Open questions / decisions for the user

1. **Is a payment service connected in Xero?** Is Stripe (or GoCardless) already connected to the
   All Ears org, and is "Pay Invoice Online" enabled on a branding theme? Without this the
   pay-now link is view-only. Also: card surcharging on/off?
2. **Custom Connection add-on cost** — NZ$10/month ex GST, billed to the All Ears Xero
   subscription, for as long as the connection exists. OK?
3. **Which revenue account code** should studio income land on (`XERO_ACCOUNT_CODE`), and confirm
   the GST tax type on that account (expected `OUTPUT2`, 15%)?
4. **Our branded email vs Xero's invoice email?** Plan assumes **our** BookingInvoice email
   carrying the `OnlineInvoiceUrl` (consistent branding, one sender). Xero can also email its own
   invoice (`POST /Invoices/{id}/Email`) — cheaper to build but off-brand and a second sender.
   Confirm the branded-email choice. (Xero reminders, if enabled, come from Xero regardless.)
5. **Due-date policy** — earlier of issue+5 days / day before session? And how long before the
   session must payment land before the admin is alerted (proposed 24 h)?
6. **Auto-cancel unpaid bookings?** MVP only alerts the admin. Comfortable ever auto-voiding +
   releasing the slot, and after how long?
7. **Verified repeat customers** (auto-confirmed, skip approval): invoice automatically at booking
   time, or admin-triggered per booking (MVP default)?
8. **Xero org-wide reminders** — fine to enable for all org customers, or studio-only nudges via
   our cron?
9. **Are org-side invoice defaults safe?** Any default branding theme/reminder/late-fee settings
   on All Ears that would surprise studio customers?
10. **`payment_method` value** for online-invoice payments: reuse `'stripe'` or widen the CHECK to
    add `'xero'`?

### Risks

- **Webhook is the single confirmation trigger** — if delivery breaks (env drift, handshake
  invalidated), paid bookings sit unconfirmed. Mitigations: admin "mark paid" path still works end
  to end (same DB-webhook side effects); Phase 3 could add a daily cron reconciliation sweep
  (`GET /Invoices?IDs=...` for `invoice_status='authorised'` rows).
- **Xero has no sandbox for a live Custom Connection** — first tests hit the real org; use $1
  invoices and void them (they'll appear in All Ears reporting until voided).
- **Contact name uniqueness** in Xero can collide with existing All Ears contacts — handled in
  `findOrCreateContact` (email match first, disambiguated name on create).
- **5-second webhook budget** — keep the route to verification + GET + DB writes only (as now).
- **Price disputes**: invoice amounts derive from `total_price_cents` at approval time; if admin
  edits a price, they must do it before approving (the invoice snapshot wins afterwards).

---

## 12. Doc references (verified July 2026)

- Custom Connections: <https://developer.xero.com/documentation/guides/oauth2/custom-connections/>
- Client credentials grant: <https://developer.xero.com/documentation/guides/oauth2/client-credentials/>
- Custom Connection pricing: <https://developer.xero.com/pricing> · FAQs: <https://developer.xero.com/faq/custom-integration>
- Invoices API (create, statuses, OnlineInvoice): <https://developer.xero.com/documentation/api/accounting/invoices>
- Contacts API: <https://developer.xero.com/documentation/api/accounting/contacts>
- Tax rates / types (OUTPUT2): <https://developer.xero.com/documentation/api/accounting/taxrates> · <https://developer.xero.com/documentation/api/accounting/types>
- Idempotency-Key: <https://developer.xero.com/documentation/guides/idempotent-requests/idempotency/>
- Webhooks (signature, ITR, events): <https://developer.xero.com/documentation/guides/webhooks/overview/>
- Rate limits: <https://developer.xero.com/documentation/best-practices/api-call-efficiencies/rate-limits>
- Payment services / Pay now button: <https://central.xero.com/s/article/About-payment-services> · <https://developer.xero.com/documentation/api/accounting/paymentservices>
- Invoice reminders: <https://central.xero.com/s/article/Set-up-invoice-reminders> · <https://central.xero.com/s/article/How-invoice-reminders-work>
