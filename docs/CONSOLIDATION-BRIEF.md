# Unit 20 Studio — full system brief, and what moving it into the crew app costs

**Written for one decision:** should the studio's back office stop being its own
Next.js admin at `studio.unit20.nz/admin` and become part of the All Ears crew
app at `crew.allears.nz`?

**Both front ends stay either way.** The public marketing + booking site is not
in question — it has to keep living at `studio.unit20.nz`, on its own domain,
indexed by Google, fast on the CDN. What's on the table is the *back* end: the
dashboard Will uses, and the automation behind it.

Everything below is what's actually in the two repos as of Sep 2026, not a plan.
Where something is genuinely unbuilt or off, it says so.

---

## 0. The short version

**The database is already one system. The applications aren't — and the split
isn't where you'd guess.**

The line does not run between "studio data" and "crew data". It runs between
**data** and **automation**:

- Every studio table already lives in the shared Supabase project. Crew already
  reads all of it. Crew already has a permission key (`studio.manage`) that
  grants **write** access to `bookings` and `customers` at the RLS level — the
  grant exists, the UI to use it was never built.
- What is *not* in the database is the whole automation layer: eleven
  transactional emails, three cron jobs, the ID-document pipeline, Xero, the
  pricing store, the booking-creation transaction wrapper. All of that is
  server-side TypeScript in this Next.js repo, and the crew app is a Vite SPA
  with no server of its own beyond a handful of Deno edge functions.

So "bring it all into the crew app" is really two very different jobs:

| | Effort | Risk |
|---|---|---|
| **Move the admin *screens*** (bookings list, customers, calendar, blackouts, discounts, pricing editor, quick-book) | Real but ordinary — React + a permission key that already exists | Low |
| **Move the *automation*** (emails, cron, ID storage, Xero, booking transaction) | Large — it needs a server the crew app doesn't have | High |

**Recommendation: split it.** Move the screens; leave the automation where it
is and give the crew app a thin authenticated API into it. You get one place to
work, without rebuilding eleven emails and three crons in Deno. Section 7 has
the shape.

---

# Part 1 — What the studio app actually is

Next.js 16 App Router (RSC) · React 19 · TypeScript · Tailwind v4 · Supabase ·
Resend + React Email · Zod + React Hook Form · React Three Fiber · Vercel
(`hnd1`, Tokyo — next to the database).

Three surfaces in one deployment: a public marketing site, a booking engine with
customer accounts, and an admin dashboard.

## 1.1 Public marketing (`app/(site)/`)

| Route | What |
|---|---|
| `/` | Landing page — 3D CDJ scene (R3F), pricing pulled live, falls back to static SVG under reduced-motion / no-WebGL / SSR |
| `/studio/the-room` | The space + gear |
| `/studio/pricing` | Price list, statically cached, revalidated on save |
| `/studio/info` | Getting in, what to bring, house rules — all from `lib/legal.ts` |
| `/about`, `/contact` | Contact form → `contact_submissions` + admin email |
| `/hire`, `/hire/[slug]` | SEO gear-hire pages (CDJ / DJM / PA hire Christchurch), statically generated with per-page OG images |
| `/terms`, `/privacy` | Legal, sharing copy with `/studio/info` via `lib/legal.ts` |

Marketing pages are **static on the CDN and served from Sydney**. Only functions
run in Tokyo. That distinction is load-bearing — see §1.7.

## 1.2 The booking engine

`components/booking/BookingFlow.tsx` — a stepped flow (date → option → time →
details → review), with the price list passed **down as props from a server
component**. Client components never import prices.

**Pricing is edited, not deployed.** The entire price list is one JSON row,
`studio_settings.key = 'pricing'` (migration `0015`), edited at `/admin/pricing`
and validated by `pricingSettingsSchema`. Flat $50+GST/hour; a weekday-daytime
2-hour deal; a prepaid 10-hour pack; a flat surcharge for groups over 4. Every
one of those is a knob, including on/off switches.

- `lib/pricing.ts` **computes, it doesn't decide** — every function takes the
  live settings. `DEFAULT_PRICING_SETTINGS` is a *fallback*, not the truth: if
  the row can't be read, the site prices from defaults and keeps taking
  bookings. It never fails a sale over a settings read.
- **Two readers on purpose.** `getPricingSettings()` is live (React-cached per
  request) for the booking API and admin; `getPublicPricingSettings()` is an
  `unstable_cache` entry tagged `studio-pricing` so marketing pages stay static.
  A save calls `updateTag` **and** `revalidatePath` on both.
- **`pricing_tiers` is a mirror.** `writePricingSettings()` rewrites its
  label/capacity/rates on every save purely because the crew app reads that
  table. Nothing computes a price from it any more.

**Booking creation is atomic** — `create_booking_slot()` (migration `0002`) does
overlap re-check + friendly-id generation + insert in one transaction. There is
no hand-rolled insert path.

**Minimum notice — 4 hours cold, 30 minutes warm** (`lib/booking-window.ts`).
Booking closes 4h before a session on a day with nothing else on it, because the
room has to be turned around. But that cost is paid once: if the day already has
a confirmed/completed session, every start from that session onwards drops to 30
minutes. Enforced twice — availability greys the slots and returns `opensAt` so
the picker can explain itself; `POST /api/bookings` re-checks against its own
clock and answers **409** (not 422) so the flow bounces back to the time picker
with a fresh list. **Admin quick-book deliberately checks none of it.**

**Discounts** — `discount_codes`, validated at `/api/discounts/validate`,
redeemed by an atomic `redeem_discount_code` RPC *after* the booking exists. If
a concurrent booking takes the last use, the booking reverts to full price
rather than giving anything away.

**Banked hours** — the 10-hour pack banks 10h to the account and draws the first
session down immediately. Signed-in customers with a balance get $0 "banked"
options. Ledger + `debit_banked_hours()` in migration `0012`.

**Rewards** — every 10 hours of *completed* play mints one single-use 50%-off
code, standard sessions only, never the pack. Idempotent, tracked by
`customers.rewards_granted_hours`.

**Blackouts** — one-off and recurring (`blackout_periods`, migration `0008`).

## 1.3 ID verification (migration `0013`)

Booking while unverified auto-emails a one-off upload link
(`/verify-id/[token]`). The customer uploads front and back of a licence or the
photo page of a passport; the admin sees both images on the booking and customer
pages and approves.

- **One row per customer.** Re-sending *rotates* the token in place, so the
  previous link dies — that's how you kill a link that's gone astray. Only the
  SHA-256 is stored.
- **Images live in the private `id-documents` bucket**, RLS-denied to everyone.
  The admin sees them through **5-minute signed URLs minted server-side**. There
  is no unauthenticated read path.
- **Approving deletes both images.** `customers.id_verified_at` is the record
  that it happened. Superseded uploads are deleted on re-submission too.
- `requestIdVerification()` never throws — an email failure must not cost
  someone their booking.

**As of this change, upload is the only path.** There is no "bring it on the
day": an unverified booking sits at `pending_verification`, nothing downstream
fires, and the cleanup cron chases then releases the slot. The copy across the
confirmation page, both first-booking emails, the reminder, the terms and the
house rules now says so — it previously offered the door as an alternative the
rest of the system never honoured.

## 1.4 Customer accounts (migration `0011`)

Supabase Auth (OTP/code-based), `/account` dashboard showing play time, banked
hours, rewards and a per-booking progress tracker.

- **The account prompt is suppressed by `customers.auth_user_id`.** The
  confirmation page and both booking emails offer signup only when that column
  is null, so it stops asking the moment someone signs up.
- The signup link **never carries their email in the query string** —
  `resolveLinkedCustomer` matches on the verified email at sign-up instead, so
  history connects itself without an address landing in logs and `Referer`.

## 1.5 The admin dashboard (`app/admin/`)

Single account, the email in `ADMIN_EMAIL`, created by hand in Supabase.

| Screen | What it does |
|---|---|
| `/admin` | Today + upcoming, attention list |
| `/admin/bookings/[id]` | Full booking: status, payment, internal note, ID panel, **Automation** checklist, progress |
| `/admin/calendar` | Month/week view |
| `/admin/customers`, `/customers/[id]` | Customer record, ID verification, banked-hours adjustment, discount emailing |
| `/admin/pricing` | The whole price list, live |
| `/admin/blackouts` | One-off + recurring |
| `/admin/discounts` | Create, disable, delete |
| `/admin/quick-book` | Walk-ins — bypasses notice rules and creates a confirmed, verified customer in one go |

**Admin auth reads the JWT, it doesn't phone home.** `proxy.ts`,
`lib/admin-auth.ts` and `lib/customer-auth.ts` use `getClaims()`, not
`getUser()`. This project signs with **ES256**, so tokens verify locally via
WebCrypto against a process-cached JWKS. `getUser()` would be a network round
trip on *every* request to `/admin` and `/account`, including every RSC
prefetch. The trade: a server-side revoked session stays valid until its access
token expires.

**Two readings of the same columns, deliberately not merged:**

- `lib/automation.ts` is the **admin's** view — "TTLock refused 3 times", "no
  record", "the paid webhook isn't wired up". Its rule: every row is a stored
  timestamp or a stored row, never inferred from booking status. Two things are
  genuinely unobservable and are labelled as such rather than faked — whether an
  email was *delivered* (no bounce webhook) and whether a door code was ever
  typed in (TTLock offline passcodes never call back).
- `lib/booking-progress.ts` is the **customer's** view of the same booking
  (Booked → ID → Confirmed → Paid → How to get in → Session → Hours added).

Merging them would mean either leaking operational failures into a customer's
inbox or blunting the admin panel.

## 1.6 Automation

**Eleven React Email templates** (`emails/`): booking confirmed, received-new-
customer, access instructions, cancelled, reminder, post-session, ID
verification request, reward earned, discount offer, account welcome, contact
form.

**Marking a booking PAID is a send button, not a bookkeeping flag.** It fires
two separate things:

1. **The door code.** A crew-side trigger (crew `0050`) enqueues a
   `studio_door_codes` row; the `issue-studio-door-code` edge function mints it
   against the TTLock and emails it (crew `0054`). It only enqueues when payment
   lands while the session is still ahead and the booking isn't cancelled.
2. **The access instructions** (`emails/BookingAccessInstructions.tsx`), sent
   once via the `access_sent_at` claim.

Both run through `runPaidAutomations()` (`lib/booking-paid.ts`), called from
**two places on purpose**: the `/api/hooks/booking-paid` Database Webhook
(covers Xero and the crew app's Studio tab) and `setPaymentStatus` in
`app/admin/actions.ts` (so the admin sees a result instead of trusting a webhook
configured in the Supabase dashboard and invisible from this repo). Running
twice is safe.

**…but only while there is still a session to get into.** `runPaidAutomations()`
reads `end_time`/`status` first and skips the whole chain for a finished or
cancelled booking. Squaring up last month's unpaid session is bookkeeping — it
used to send that customer directions, a "your code arrives separately" line
that was never true, and a what-to-bring list for a night they'd already played.

**Cron** (`vercel.json`, all bearer-guarded by `CRON_SECRET`):

| Path | Schedule | What |
|---|---|---|
| `/api/cron/reminders` | 07:00 NZ | 24h-out reminder |
| `/api/cron/post-session` | 08:00 NZ | marks completed, follow-up email, mints rewards |
| `/api/cron/cleanup` | 03:00 NZ | warns then **releases** stale `pending_verification` bookings |

The cleanup cron reads first and decides in code, deliberately: past sessions
are left alone, a session inside 12 hours is never auto-cancelled, and a warning
is only stamped when the email actually sent.

**Other endpoints:** `/api/calendar/feed` (ICS subscription),
`/api/bookings/[id]/ics`, `/api/webhooks/xero`, `/api/contact`.

## 1.7 The Tokyo thing

`"regions": ["hnd1"]` in `vercel.json`. **Don't remove it.** Supabase is in
ap-northeast-1. Without it Vercel defaults to `iad1` and every query goes NZ →
Sydney → Virginia → Tokyo and back:

| Region | N=1 query | N=3 | N=5 |
|---|---|---|---|
| `iad1` (old default) | 555ms | 895ms | 1,235ms |
| `syd1` (nearest users) | 295ms | 515ms | 735ms |
| **`hnd1` (with the DB)** | **292ms** | **296ms** | **302ms** |

The prize is the flat column: an extra sequential `await` costs ~2ms instead of
170ms. This moves **functions only** — static marketing pages stay on the CDN in
Sydney.

**This is a real consideration for consolidation.** The crew app is a browser
SPA talking to Supabase directly from the user's device in Christchurch. Every
query is a NZ → Tokyo round trip with no server-side batching. A studio admin
screen that makes 5 sequential reads costs ~300ms in the Next.js app and closer
to 1.5s in the SPA. Screens that need several dependent reads (a booking page
with customer, tier, ID row, door codes, automation state) should either be one
RPC or accept being slower.

---

# Part 2 — The data model, and who owns what

One Supabase project: **`abqkmovvgkrdunyrqhfp`**. Two independently-deployed
front ends. A schema change in either repo can break the other.

## 2.1 Studio-owned tables (migrations `0001`–`0015` in this repo)

| Table | Notes |
|---|---|
| `customers` | **Crew reads this.** Renaming a column breaks the crew app silently. |
| `bookings` | **Crew reads and — via `studio.manage` — may write this.** Carries two crew-owned triggers. |
| `pricing_tiers` | **Crew reads this.** Now a mirror of `studio_settings.pricing`. |
| `contact_submissions` | **Crew reads this** (Studio tab enquiries). |
| `blackout_periods` | Studio only |
| `booking_counters` | Friendly-id sequence, atomic |
| `newsletter_subscribers` | Placeholder, unused |
| `discount_codes` | Studio only (crew `0058` is a DO-NOT-RUN mirror) |
| `hour_ledger` | Banked hours. Studio only. |
| `id_verifications` | Studio only. One row per customer. |
| `studio_settings` | The pricing JSON. RLS-denied to everyone; service-role only. |

Storage: the private **`id-documents`** bucket, RLS-denied, signed URLs only.

`0009`, `0010` and `0014` in this repo are **DO-NOT-RUN mirrors** of crew
`0057`/`0058`/`0124` — they exist so this repo's schema file set is readable,
not to be applied.

## 2.2 Crew-owned things attached to studio tables

| Object | Migration | What it does to us |
|---|---|---|
| `studio_gear_available(start,end)` | crew `0077`/`0078`, rules rewritten `0101` | `SECURITY DEFINER`. Sees every job, returns a bare boolean. |
| `BEFORE INSERT/UPDATE` trigger on `bookings` | crew `0077` | Rejects a studio booking on a day the decks are out. |
| `studio_door_codes` + enqueue trigger | crew `0050`, `0054` | Mints and emails the TTLock code when payment lands. |
| `studio_board_cards()` | crew `0027`, restated `0131` | PII-free feed of confirmed bookings for the crew Board. |
| `studio_gear_conflicts()` | crew `0163` | Admin-side display conflict list. |
| `crew_shifts.studio_booking_id` | crew `0071` | "Studio setup" shift generated from a booking. |
| `bookings` RLS: crew read | crew `0042` | Any **active crew member** may read bookings + customers. |
| `bookings`/`customers` RLS: crew write | crew `0163` | `has_perm('studio.manage')` grants UPDATE. |
| Release-not-delete rules | crew `0120`, `0130` | A stale booking is cancelled, not destroyed. |

## 2.3 The gear block, precisely

This is the one rule most likely to be mis-summarised, so:

**What blocks:** a **crewed** job (never a dry hire) whose equipment list names
**both** the CDJs *and* the DJM-A9. Either one alone doesn't block. A cable-kit
row that happens to match `%cdj%` doesn't block.

**When:** whole NZ days, from the load-out day (`pack_in_date`) through the show
day (`job_date`) — and deliberately stops there. A gig running 9pm–3am packs out
overnight and the gear is back before the studio opens at 10:00, so the next day
stays bookable.

**How the studio sees it:** it doesn't. This app books as an anonymous role that
**cannot see jobs at all**. `/api/bookings/availability` greys blocked days by
calling the `studio_gear_available` RPC — one bare boolean per day, which is
exact because the block is whole-day. A failed insert comes back as
`hint === 'GEAR_BLOCKED'` and the API turns it into a 409 with the trigger's own
customer-safe wording.

If a booking insert fails with a gear error, **that is working as designed.**

## 2.4 Shared Supabase Auth

Both apps are code-based (OTP), so the Magic Link and Confirm-signup templates
must both include `{{ .Token }}` and the wording must stay neutral. Changing one
app's auth email changes the other's. See `docs/AUTH.md` in both repos.

---

# Part 3 — What the crew app can do with studio data today

The crew app is **Vite + React 18 + TanStack Query + Tailwind**, an installable
PWA, hosted on Vercel, with Deno edge functions for anything needing a server.
Permissions are per-person in one precedence chain (`0163`): owner → explicit
`crew_permissions` → `role_permissions` → false. 40 keys, four roles.

## 3.1 What it has

**`/studio` — the Studio tab** (`src/pages/StudioBookings.tsx`, 378 lines):

- Booking requests in two lanes (Pending / Confirmed), newest first. Completed
  and cancelled drop off entirely.
- Customer name, email, phone, tier, group size, total, payment status, notes.
- Contact-form enquiries.
- **Gear-clash warnings** — `gearClash.ts` cross-references booking times
  against jobs whose packing list names clash gear, and shows a red card.
- **"Add setup shift"** — creates a draft crew shift starting 1h before the
  booking, guarded against duplicates by a DB unique index.

**Door codes** (`StudioDoorCodesPanel`, on the Studio page and Directory) —
every auto-issued code grouped Active / Soon / Past, with issue, re-process and
**revoke**. Per-booking re-issue needs a crew JWT holding `doorcodes.manage`,
which is why the studio admin's `retryDoorCode` can only poke the same queue.

**The Board** — confirmed studio sessions appear as cards alongside crew jobs,
colour + word + border style (`studioCardStyle`): solid green "Studio", dashed
amber "Unconfirmed", muted "Done". Contacts come from a *separate* RLS-governed
query because `studio_board_cards()` is deliberately PII-free.

## 3.2 What it can't do

Everything that needs a server:

- Approve an ID (needs the signed-URL pipeline **and** the image deletion)
- Mark paid *with the automations firing* (it can write the column; the emails
  and the door code hang off `runPaidAutomations()`, which lives here)
- Send/rotate an ID link, resend a confirmation, cancel-with-email
- Edit pricing (`studio_settings` is service-role only)
- Quick-book (needs `create_booking_slot` orchestration + customer creation)
- Manage blackouts or discount codes
- Adjust banked hours
- See the Automation checklist or the customer progress tracker
- Anything Xero

## 3.3 The asymmetry worth noticing

Crew's studio surface is **wide and shallow**: it sees everything, changes
almost nothing. The studio admin is **narrow and deep**: it sees only the
studio, and every button does real work.

That's exactly why the crew app feels "limited and buggy" for studio work — it
was built as a *window*, not a workshop. It isn't broken so much as it was never
asked to be the place you do the job.

---

# Part 4 — What moving the back end would actually cost

## 4.1 Straightforward (a week or so of ordinary React)

These are screens over tables the crew app already reads, with a permission key
that already exists and RLS that already grants the write:

- **Bookings list + detail** — status, payment, internal note. The
  `studio.manage` UPDATE policy is live (crew `0163`).
- **Customers list + detail** — same.
- **Blackouts** — plain CRUD on `blackout_periods`; add an RLS policy.
- **Discounts** — plain CRUD on `discount_codes`; add an RLS policy.
- **Calendar** — the crew app already renders studio cards; a studio-only view
  is a filter, not new plumbing.

The one caveat is §1.7: these become browser-side queries from Christchurch to
Tokyo. Keep them to one round trip per screen, or wrap them in an RPC.

## 4.2 Awkward but doable

**Pricing editor.** `studio_settings` is service-role-only by design (there is
no customer-facing read path — prices reach the browser only as props from a
server component). To edit it from an SPA you'd either add a `has_perm`-gated
RLS policy, or put it behind an edge function. Then the cache-invalidation
problem: a save currently calls `updateTag('studio-pricing')` **and**
`revalidatePath` on `/` and `/studio/pricing`. Miss the second and the landing
page keeps serving last week's rate out of prerendered HTML. A crew-side save
must therefore call back into the studio app to revalidate — a webhook or a
signed endpoint. **This is the single most under-appreciated coupling in the
whole system.**

**Quick-book.** Needs `create_booking_slot` plus customer creation plus the
verified-flag shortcut. Could be one `SECURITY DEFINER` RPC. Worth doing that
way regardless — it'd remove a hand-rolled path from the admin actions file.

**Banked-hours adjustment.** A plain insert into `hour_ledger` with a
`has_perm` policy. Easy; just needs the ledger's RLS opened carefully, since
negative deltas are allowed.

## 4.3 Genuinely hard — needs a server the crew app doesn't have

**The eleven emails.** They're React Email components rendered server-side and
sent via Resend. To send them from the crew app you'd rewrite each as a Deno
edge function with hand-built HTML, or call back into this app. Rewriting them
means maintaining two email codebases for one business, and the studio site
still needs its own copies for the customer-triggered sends.

**The three crons.** Vercel cron hits Next.js routes here. The crew app would
need `pg_cron` + edge functions, and the cleanup cron in particular is not a
one-liner — it's a policy (warn, wait, release, refund banked hours, hold back
imminent sessions) that reads first and decides in code precisely because the
old `DELETE ... WHERE` version destroyed rows before anyone could look at them.

**ID verification.** The whole pipeline is server-side: mint token → hash →
email → private bucket upload → 5-minute signed URLs → approve → **delete both
images**. Signed-URL minting needs the service role. This is also the piece with
the most liability attached; it is the last thing to reimplement casually.

**`runPaidAutomations()`.** The thing that makes "Mark paid" a send button. It
reads the booking, decides whether the session is still ahead, fires the door
code enqueue and the access email, and claims `access_sent_at` idempotently. It
is called from two places on purpose and is safe to run twice. Rebuilding it in
Deno means rebuilding that reasoning, and getting it wrong means someone stands
outside a locked roller door.

**Xero.** Code-complete but **OFF in production** — the four `XERO_*` env vars
aren't set in Vercel, so the client throws and the webhook can't validate
signatures. Invoices are created manually. Note the crew app has its *own*
studio-invoicing path (crew `0057`) plus an admin invoicing worklist (`0167`).
**Check both before changing invoicing.** This is the one area where
consolidation would remove genuine duplication rather than create work.

**The booking transaction.** `create_booking_slot()` is already in the database
and race-safe — but everything around it (banked-hours draw with rollback,
discount redeem-or-revert, pack crediting) is orchestrated in the API route with
compensating writes on failure. That orchestration is ~200 lines of "if this
step fails, undo the last one". It should not be rewritten twice.

## 4.4 Must not move

- **The public booking site.** SEO, CDN, its own domain.
- **The gear block.** Already in the database, which is the right place.
- **Anonymous-role isolation.** The studio books as a role that can't see jobs.
  Any consolidation must keep the *public* path on that role.
- **The two readings (§1.5).** If the crew app renders the customer progress
  tracker, it must not merge it with the admin automation checklist.

---

# Part 5 — Where the crew app is actually buggy for studio work

Worth naming specifically, because "it's buggy" and "it's limited" are different
problems and only one of them needs a rewrite:

1. **The Studio tab renders the raw database enum.** `StudioBookings.tsx:209`
   sets `status = b.status.toLowerCase()` — so the value is
   `'pending_verification'`. Then:
   - `statusTone()` (line 34) tests for `'pending'`, misses, and falls through
     to the `slate` default instead of grey.
   - `titleCase()` (line 46) only upper-cases the first letter, so the chip
     literally reads **"Pending_verification"**.

   The Board's `studioCardStyle()` handles the same column correctly ("Unconfirmed",
   dashed amber). Two mappings of one column, one of them wrong — and it's the
   one on the page named "Studio".
2. **The tab hides completed and cancelled entirely** (`laneKey()` returns
   null). Fine as a worklist, useless as a record — there's no way to look up
   last month's session from the crew app.
3. **No write path at all**, despite the RLS grant existing. Every action is
   "open the studio admin in another tab."
4. **PII-free board cards + a second contact query** is correct but means two
   sources for one card; a booking that arrives between the two queries draws
   without a name.
5. **No pagination anywhere** — `useStudioBookings` selects every booking ever,
   ordered by `created_at`. Fine now, not fine in two years.

Items 1, 2 and 5 are small fixes worth doing **regardless of the consolidation
decision**. Item 3 is the actual ask.

---

# Part 6 — What the two apps disagree about

Things that are true in one codebase and not reflected in the other. Each is a
latent bug:

| Fact | Studio | Crew |
|---|---|---|
| Booking statuses | 5 (`pending_verification`, `confirmed`, `completed`, `cancelled`, `no_show`) | `studioCardStyle` handles 3 + fallback; `statusTone` handles 2 + fallback and gets pending wrong |
| Payment statuses | 4 (`unpaid`, `paid`, `refunded`, `comped`) | `paymentTone` handles 3 + "amber for anything else" |
| `pricing_tiers` | A **mirror**, rewritten on every pricing save | Read as though it were the source of prices |
| Discount codes | `discount_codes`, studio-owned | crew `0058` is a DO-NOT-RUN mirror — two schema files for one table |
| Xero invoicing | `lib/xero-booking.ts`, off in prod | crew `0057` + `0167` worklist, on |
| ID verification | Full pipeline | Not modelled at all — crew can't tell "no ID sent" from "uploaded, awaiting approval" |

**`pricing_tiers` is the sharpest one.** If anyone ever writes a price into that
table from the crew side, the next studio pricing save silently overwrites it.

---

# Part 7 — Recommended shape

**Don't move the automation. Move the screens, and give the crew app a door
into the automation that already works.**

Concretely:

### Step 1 — Fix the cheap bugs (§5 items 1, 2, 5)
Half a day. Independent of everything else, worth doing now.

### Step 2 — Studio admin API in this repo
A small set of authenticated endpoints under `/api/admin/*`, called by the crew
app with the crew user's Supabase JWT, verified here against `has_perm('studio.manage')`.
Each one wraps a function that already exists and is already correct:

| Endpoint | Wraps |
|---|---|
| `POST /api/admin/bookings/:id/payment` | `setPaymentStatus` → `runPaidAutomations()` |
| `POST /api/admin/bookings/:id/status` | `setBookingStatus` |
| `POST /api/admin/bookings/:id/cancel` | `cancelBooking` (+ email) |
| `POST /api/admin/customers/:id/verify` | `verifyCustomer` (+ image deletion) |
| `POST /api/admin/customers/:id/id-link` | `resendIdVerification` |
| `GET  /api/admin/customers/:id/id-documents` | signed URLs, 5-minute |
| `POST /api/admin/quick-book` | `quickBook` |
| `PUT  /api/admin/pricing` | `writePricingSettings` **+ both cache invalidations** |

This is the whole trick: **the automation stays in one place, tested, in Tokyo,
next to the database — and the crew app gets to drive it.** No email is
rewritten. No cron moves. The pricing cache invalidation can't be forgotten,
because the endpoint that saves is the endpoint that revalidates.

### Step 3 — Build the crew-side screens
Reads go direct to Supabase (fast enough, already permissioned). Writes go
through Step 2's endpoints. Start with the booking detail page — status,
payment, ID approve, internal note — because that's 90% of the daily work.

### Step 4 — Retire what's genuinely duplicated
Once the crew screens are live, the studio admin can shrink to what only it can
be: the pricing editor (until Step 2 covers it) and a break-glass fallback.
**Don't delete it.** It's the only surface that works if the crew app is down,
and it's where the automation lives anyway.

### What this buys
- One place to work — the actual ask.
- No rewrite of eleven emails, three crons, or the ID pipeline.
- The Tokyo latency advantage is kept for exactly the operations that need it.
- Xero duplication becomes visible and resolvable in one place.

### What it costs
- A new authenticated API surface (real, but small and mechanical).
- The crew app gains a dependency on `studio.unit20.nz` being up for writes.
  Reads keep working if it isn't.

---

# Appendix A — File map (studio)

```
app/(site)/      marketing + booking + customer account
app/admin/       dashboard (bookings, calendar, customers, pricing, blackouts,
                 discounts, quick-book)
app/api/         bookings, availability, discounts, contact, cron/*, hooks/*,
                 webhooks/xero, verify-id
components/      admin/ booking/ studio/ hire/ three/ layout/ ui/ contact/ account/
lib/             pricing (+ pricing-settings/pricing-store), banked-hours,
                 rewards, discounts, booking-window, booking-paid,
                 booking-progress, automation, id-verification, notifications,
                 timezone, ics, email, seo, xero, legal, supabase/
emails/          11 React Email templates
supabase/migrations/  0001–0015 (0009, 0010, 0014 are DO-NOT-RUN mirrors)
design-system/   MASTER.md (locked — read before changing anything visual)
```

**Checks:** `npm run build` is the one that matters (it type-checks). No test
suite. Playwright is a devDependency with no committed specs.

# Appendix B — Environment

| Var | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | public reads (pricing tiers, blackouts) |
| `SUPABASE_SERVICE_ROLE_KEY` | everything server-side |
| `RESEND_API_KEY` | all email |
| `ADMIN_EMAIL` | the single admin account |
| `CRON_SECRET` | bearer guard on all three crons |
| `NEXT_PUBLIC_LIVE_URL` | the "Live" link out to the separate ticketing site |
| `XERO_*` (four) | **not set in production** — invoicing is manual |

Without Supabase/Resend the marketing site still runs: the calendar shows all
slots open, email and admin are disabled.

# Appendix C — Known gaps

- **Xero is code-complete but OFF.** See `XERO-TODO.md` and
  `docs/PLAN-xero-invoicing.md`. Check crew `0057` too.
- **Photography is gradient placeholders** — swap to `next/image` where marked.
- **No bounce webhook**, so "delivered" is genuinely unobservable and the
  automation panel says so rather than guessing.
- **TTLock offline passcodes never call back**, so "was the code used?" is
  unobservable too.
- **Scope is deliberately studio-only.** No copy about shows, club nights or a
  room for hire — that's Unit 20 Live, a completely separate FastAPI stack on
  EC2, reached only through the "Live" link.
