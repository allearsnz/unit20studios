# PLAN — Xero for the studio

**Status:** planning only. Nothing in this document has been built, and nothing in it
should be built until §8 is answered.

**Where it sits among the other Xero docs:**

| Doc | What it is | Still true? |
|---|---|---|
| `/XERO-TODO.md` | the interim "invoices are manual" note | yes, and stays true through Phase 0 |
| `docs/PLAN-xero-invoicing.md` | the deep API research + the invoice-per-booking design | **API research: yes.** Shape: superseded below |
| `docs/PLAN-studio-prepay.md` | Stripe Checkout collects, Xero records | yes — this doc is the "Xero records" half, expanded |
| **this doc** | what actually syncs, when, on whose credentials, and in what order to build it | — |

---

## 0. The two findings that shape everything below

### 0.1 There is no crew Xero connection to reuse. The studio's is the only one.

The brief for this work assumed the crew app "genuinely talks to Xero" and that reusing its
already-authenticated connection would be cheaper than a second OAuth app. It would be — but it
does not exist. Checked directly in `../all-ears-crew`:

- No Xero API client, no OAuth code, no token storage, no `xero_*` table, and none of the 18
  Supabase edge functions mentions Xero.
- `src/features/quote-document/invoicing.ts` is an explicit stub. Its own header says so: *"Nothing
  here talks to Xero"* and *"the day there's a real Xero OAuth app, `xeroInvoicing` implements the
  same three methods"*. `/quotes/:id/xero` builds JSON to paste and a CSV to import by hand.
- `job_invoicing` (crew `0034`) tracks **stage only** — `to_invoice / invoiced / paid` — with a
  deliberate no-amounts rule: *"money lives in Xero, this is just 'have we invoiced yet?'"*.
- Crew `0057_studio_xero_invoicing.sql` sounds like a crew integration and is not: it only adds the
  studio's own invoice columns to the shared `bookings` table, because that table lives in the
  crew migration chain. The studio repo mirrors it as `0009`.
- `docs/ACCEPTANCE.md` item 32 grades the Xero handoff **PARTIAL**, and flags that nothing ever
  sets a quote to `invoiced`, so the crew hub's "ready to invoice" list never empties.

**So the direction of reuse is the opposite of the assumption.** The only code in either repo that
speaks the Xero API is `lib/xero.ts` **here**, and it is dormant for want of env vars. The
recommendation is therefore: create **one** Custom Connection, land it in this repo, and let the
crew app adopt the same credentials later — see §3. That is still one connection and one monthly
add-on, which was the point of the original question.

> Not a substitute: Will's Claude account has a Xero connector attached (that is how the figures in
> §0.2 were read). That is a per-user read-only connector on Anthropic's side, not a credential an
> application can hold. It is useful for answering questions about the books; it cannot write an
> invoice from a Vercel function.

### 0.2 Invoice-per-booking would swamp a ledger it contributes almost nothing to.

Read from the live All Ears Events Ltd org (NZ, NZD, Pacific/Auckland), 1 May – 12 Aug 2026:

| | |
|---|---|
| Sales invoices raised | **70** in ~3.5 months (~240/yr) |
| Total invoiced | **$105,479** NZD |
| Average invoice | **~$1,507** |
| Distinct contacts | 57, essentially all AV clients and venues |

A studio session is **$50–$110 + GST**. At even three or four sessions a week, invoice-per-booking
adds **150–300 invoices a year** — roughly doubling the invoice count and stretching the contact
list by hundreds of one-off hobbyist DJs — in exchange for about **3%** of revenue. It would also
wreck the two things the contact list is currently good for: "top customers by revenue" and knowing
who All Ears actually works with.

And under the prepay design (`PLAN-studio-prepay.md`) those invoices would have **no accounts-
receivable purpose at all**: Stripe collects the money before the booking is confirmed, so every
invoice would be created already paid. An ACCREC invoice that is never outstanding is a journal
entry wearing a costume.

**Hence the shape recommended below: a periodic summary invoice, one contact, per-booking line
items — with per-booking invoices kept as an exception for the customers who genuinely need one.**

---

## 1. What syncs

Three separate questions that the earlier plan ran together. Answering them separately is what
makes this small.

### 1.1 Revenue → Xero: a periodic summary invoice (recommended)

- **One Xero contact**, created once, by hand: `Unit 20 Studio — online bookings`. Not one contact
  per customer (§0.2). Customer identity stays in Supabase, where it is already better.
- **One ACCREC invoice per period** (recommendation: weekly, Mon–Sun NZ), `AUTHORISED`, with **one
  line item per paid booking**: `U20-2026-0042 · Sat 1 Aug 19:00–21:00 · 2h · 4 people`, ex-GST
  unit amount, `AccountCode = XERO_ACCOUNT_CODE`, `TaxType = OUTPUT2`.
- **Reference** = the period, e.g. `Studio 2026-W31`. Uniquely re-derivable, which is what makes
  the whole thing idempotent (§4).
- Discounts, reward codes and group surcharges appear as their own lines, exactly as
  `createBookingInvoice()` already builds them for a single booking — the line-building code is
  written and only needs to loop.
- **Banked-hours ($0) sessions produce no line.** The money was recognised when the 10-hour pack
  was sold; recognising it again at redemption would double-count. The pack purchase itself is a
  real $250 sale and does get a line.

### 1.2 Payment → Xero: one `PUT /Payments` per summary invoice

The invoice is settled against the **Stripe clearing account** so the weekly total reconciles
against the Stripe payout, and the invoice reads PAID rather than sitting in aged receivables
forever. This is the one Xero call that does not exist yet in `lib/xero.ts`; the prepay plan
already scoped it as `applyInvoicePayment()`.

Until Stripe is live and payment is in person or by bank transfer, skip this — leave the summary
invoice AUTHORISED and let Will reconcile it in Xero the way he does today. That is strictly
better than the current state (no invoice at all) and costs nothing.

### 1.3 Per-booking invoice: on demand only, and for the pay-by-invoice path

Two real cases survive:

- **A customer asks for a tax invoice** — a studio hire on a company card, a music-school booking.
  Rare, and an admin button (`createInvoiceForBooking`, already written and already wired to the
  admin actions) covers it. That booking is then excluded from its week's summary.
- **Phone / corporate bookings that pay by invoice** rather than through the site. This is the
  existing `invoiceBooking()` + `emailInvoice()` + Xero-webhook path, which already works end to
  end on paper and is the reason `XERO_WEBHOOK_KEY` exists. Keep it.

So nothing already written gets thrown away. What changes is that per-booking invoicing stops being
the **default** and becomes the exception.

---

## 2. When it fires

| Event | What happens | Where |
|---|---|---|
| Booking paid | **Nothing Xero-side.** Door code + access email only. | existing `runPaidAutomations` |
| Weekly, Mon 04:00 NZ | Build last week's summary invoice from `bookings` where `payment_status IN ('paid','comped')` and `end_time` inside the period and `invoice_status = 'not_invoiced'` | new `/api/cron/xero-summary` |
| Same run, after the invoice exists | `PUT /Payments` against the clearing account (only when Stripe is live) | same route |
| Same run | Retry any period whose invoice is stuck (§4) | same route |
| Admin clicks "Invoice this booking" | Single ACCREC invoice, Xero emails the pay-now link | existing `createInvoiceForBooking` |
| Xero reports that invoice paid | `payment_status = 'paid'` → door code + access email | existing `/api/webhooks/xero` |

**Deliberately not real-time.** A booking paid at 9pm on a Saturday does not need a ledger entry at
9pm on a Saturday, and a nightly/weekly job is one place to look when something goes wrong instead
of one per booking. It also means a Xero outage is invisible to customers by construction, not by
care.

Cron budget note: `vercel.json` already runs three daily crons. A weekly job is one more entry and
stays inside the Hobby-plan limits; if it doesn't, fold it into the existing daily
`post-session` route and no-op on six days out of seven.

---

## 3. Auth — shared or separate?

**Recommendation: one Xero Custom Connection, credentials owned by this repo, shared with the crew
app by copying three env vars if and when the crew app needs them.**

Why this is barely a decision:

- A Custom Connection uses OAuth2 **client_credentials**. There is no user consent, **no refresh
  token, and nothing to store or rotate** — you exchange client id + secret for a ~30-minute access
  token whenever you need one. `lib/xero.ts` already fetches a token per call, which at a handful of
  calls a week is the right amount of machinery.
- Because there is no token *state*, "sharing" is just both Vercel projects holding the same
  `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / `XERO_TENANT_ID`. No shared token table, no lock, no
  refresh race between two apps — which is the failure mode that makes shared OAuth2 unpleasant.
- Billing is **per connection**, so two apps on one connection is **one** NZ$10/month ex GST
  add-on, not two.
- One connection also means one thing to revoke.

**The alternative, and why not:** standard authorisation-code OAuth2 is free but needs a browser
consent, `offline_access`, and **single-use refresh tokens that must be persisted and rotated**.
Two apps over one shared Supabase project would then be two writers to one token row, racing to
rotate it, with a broken chain requiring a human at a browser to fix. For a single-org integration
that is real ongoing risk to avoid a $120/year line item. Only revisit if the add-on is refused.

**If the crew app later wants in** (the likeliest trigger: making
`src/features/quote-document/invoicing.ts` actually post its draft instead of exporting CSV), it
adopts the same three env vars and implements the existing `InvoicingProvider` interface. Nothing
here needs to change to allow it. The one thing worth agreeing up front is that both apps write to
**different account codes** (or at least different References) so it stays obvious in the ledger
which system raised what.

---

## 4. Failure

The governing rule, unchanged from `PLAN-studio-prepay.md` §4: **money → booking → books, in that
order, each independent of the next.** Xero being down must never keep a paying customer out of the
studio. Under this design that is structural — Xero is not on the customer's path at all.

- **Idempotency by re-derivable Reference.** Before creating a period's invoice, `GET /Invoices?
  where=Reference=="Studio 2026-W31"`. If one exists, adopt it rather than create it. Belt and
  braces: send an `Idempotency-Key` of `studio:week:2026-W31`, the same pattern
  `createBookingInvoice()` already uses per booking.
- **Per-booking claim, reused.** Each booking rolled into a summary gets `invoice_status` moved
  `not_invoiced → creating → paid`, with `xero_invoice_id` set to the summary invoice. The atomic
  claim + rollback in `invoiceBooking()` is exactly this, and stops a re-run double-billing a
  booking into two periods.
- **A failed run leaves bookings at `not_invoiced`**, so the next run picks them up. Periods are
  therefore self-healing and a missed week costs nothing.
- **A run that fails twice emails the admin** via `notifyAdmin`, the same way the existing crons
  report. Silence is the failure mode this codebase has already been bitten by (see the cleanup
  cron incident in crew `0120`).
- **Never partially settle.** If the invoice is created but `PUT /Payments` fails, the invoice
  stays AUTHORISED and the next run retries the payment only. An AUTHORISED-but-unpaid invoice is
  visible and fixable; a payment applied to the wrong account is not.
- **No auto-void, ever.** If a booking is refunded after its week has been invoiced, that is a
  credit note, and a credit note is a human decision (§5).

---

## 5. Manual forever

Worth stating so nobody builds them by accident:

- **Bank reconciliation and GST returns.** Xero's job.
- **Credit notes and refunds.** A refund is a judgement about a customer, not an event. The
  automation may *surface* that a refunded booking sits inside an already-invoiced week; a person
  decides what to do.
- **Chasing unpaid invoices.** Only applies to the pay-by-invoice exception path, which is
  low-volume by definition.
- **The revenue account code and tax treatment.** Configured once, by Will, in Xero.
- **Comps.** `payment_status = 'comped'` produces no revenue line, and if a comp ever needs to
  appear in the books as a marketing expense that is a manual journal.
- **Anything to do with the crew side's quotes** until someone deliberately implements
  `xeroInvoicing` over there.

---

## 6. Phased build order

### Phase 0 — the cheapest useful thing, and it needs nothing from Xero

**A weekly studio-revenue export in `/admin`.** One page: pick a week, see every paid booking, the
ex-GST subtotal, GST and total, plus a copy-to-clipboard block and a CSV in Xero's Sales Invoice
import format.

- **Cost:** hours. No Custom Connection, no NZ$10/month, no OAuth, no webhook, no new secrets, and
  nothing that can fail in production at 3am.
- **Value:** it removes the actual manual work today, which is *reading bookings out of the admin
  one at a time to key an invoice*. Once the numbers arrive as one block, keying one weekly invoice
  is a two-minute job.
- **Precedent:** the crew app already does exactly this at `/quotes/:id/xero`
  (`src/features/quote-document/invoicing.ts` builds both JSON and a Xero-format CSV). Copy the
  shape, including `INVOICING_DEFAULTS` — account code `200`, `OUTPUT2`, NZD.
- **It is also the honest test of the whole idea.** If Will imports that CSV for a month and the
  ledger looks right, Phase 1 is mechanical. If it looks wrong, we found out for free.

### Phase 1 — automate what Phase 0 proved

Custom Connection created and authorised; `XERO_*` env vars set in Vercel; the weekly cron creates
the summary invoice through the API instead of a human importing a CSV. Broaden the token scope
from `accounting.transactions.read` to `accounting.transactions` (already noted in
`PLAN-xero-invoicing.md` §3.1). Keep the Phase 0 export page — it is the fallback and the audit
view.

### Phase 2 — settle it

`applyInvoicePayment()` against the Stripe clearing account, so weekly invoices read PAID and
reconcile to the payout. **Depends on the Stripe work in `PLAN-studio-prepay.md`**, not on
anything here.

### Phase 3 — the exception paths

The already-written per-booking flow, turned on for "send this customer a tax invoice" and for
phone/corporate pay-by-invoice bookings, plus the Xero payment webhook that marks those paid. Most
of this is code that already exists; the work is the admin affordance and testing.

### Phase 4 — optional, only if wanted

Crew-side adoption of the same credentials for quote → invoice, retiring the CSV handoff and
finally letting `quotes.status = 'invoiced'` mean something (crew `ACCEPTANCE.md` item 32).

---

## 7. What this changes in the repo (Phase 0–1 only)

Small, and mostly additive:

- `app/admin/(dashboard)/revenue/page.tsx` — the weekly export (Phase 0).
- `lib/xero-summary.ts` — build a period's lines from bookings; pure, so it can be read and
  checked without a Xero connection.
- `app/api/cron/xero-summary/route.ts` + a `vercel.json` entry (Phase 1).
- `lib/xero.ts` — broaden scope; add `findInvoiceByReference()` and later `applyInvoicePayment()`.
- **No new database columns.** `invoice_status`, `xero_invoice_id`, `invoiced_at` and `paid_at`
  (studio `0009` / crew `0057`) already carry everything a summary needs; `xero_invoice_id` simply
  holds the summary invoice's id for every booking in that period. If a period identifier is ever
  needed as a column, that is a crew-chain migration and a later decision — do not add one
  speculatively.

---

## 8. Decisions only Will can make

Recommendation given for every one. Nothing should be built past Phase 0 until 1–4 are answered.

1. **Summary invoice, or invoice per booking?**
   → **Recommendation: weekly summary, one contact.** §0.2 has the numbers: per-booking adds
   150–300 invoices and hundreds of contacts a year for ~3% of revenue, and under prepay those
   invoices are paid before they exist. Keep per-booking for customers who ask.

2. **Weekly or monthly periods?**
   → **Recommendation: weekly.** It matches Stripe payout cadence closely enough to reconcile
   comfortably, and a mistake is one week of lines to fix rather than a month.

3. **Which revenue account code, and is `OUTPUT2` (GST on Income, 15%) right?**
   → **Recommendation: a dedicated "Studio hire" sales account, not the AV account (`200`).** The
   whole reason for a summary is to keep studio income legible next to $1,500 AV invoices; posting
   it to the same code throws that away. Cannot be confirmed from here — needs the chart of
   accounts. The org is NZ/NZD, so `OUTPUT2` is the expected tax type.

4. **Is the NZ$10/month ex GST Custom Connection add-on acceptable?**
   → **Recommendation: yes, and it is the *only* auth worth paying for here** (§3). If refused,
   stay on Phase 0 permanently rather than build refresh-token storage — the CSV import is a
   two-minute weekly job and honestly fine at this volume.

5. **Is Stripe already connected to the Xero org as a payment service, and which account do Stripe
   payouts clear through?**
   → **Recommendation: find out before Phase 2, not during.** Needed as an `AccountID` for
   `PUT /Payments`. Could not be verified from here.

6. **Should the crew app share these credentials, or stay on its CSV handoff?**
   → **Recommendation: stay on CSV for now.** The crew handoff is a genuinely different shape
   (quotes, drafts a human reviews before authorising) and its acceptance doc already lists a bug
   in front of it. Share the credentials when someone actually builds it — §3 keeps that door open
   at zero cost.

7. **Do studio customers ever need a Xero-issued tax invoice by default?**
   → **Recommendation: no.** Stripe's receipt is a valid GST receipt for a $57.50 session. Offer a
   Xero invoice on request (Phase 3).

8. **What happens to a refund inside an already-invoiced week?**
   → **Recommendation: surface it, never automate it.** A refunded booking inside a closed period
   should show up on the admin revenue page as needing a credit note, and stop there.

---

## 9. What could not be verified from here

Stated plainly so nothing below is mistaken for a checked fact:

- **Whether the Custom Connection add-on has been purchased, or the app created.** No credentials
  exist in this repo or in `.env.local`; `lib/xero.ts` throws "not configured" as designed.
- **The chart of accounts** — so the recommended account code in §8.3 is a recommendation about
  *shape*, not a code.
- **Whether Stripe is connected to the Xero org**, and the clearing account's `AccountID`.
- **Whether "Pay Invoice Online" is enabled on a branding theme.** Without it the per-booking
  pay-now link (Phase 3) is view-only.
- **Whether the `bookings` paid Database Webhook exists in the Supabase dashboard** with a bearer
  token matching `BOOKING_HOOK_SECRET`. It is configured outside both repos and cannot be read from
  code. The admin Automation tab now makes its absence visible after the fact — a paid booking with
  no access-email attempt recorded means it did not fire — but that is detection, not proof either
  way today.
- **Live Xero API behaviour.** Every API detail here is inherited from
  `PLAN-xero-invoicing.md` §3, which was verified against the docs in July 2026, plus the read-only
  org figures in §0.2. Nothing was executed against the Accounting API.
