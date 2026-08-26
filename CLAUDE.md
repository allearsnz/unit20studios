@AGENTS.md

# Unit 20 Studio — agent guidance

`README.md` is the setup + admin guide and is accurate. This file is the fast
orientation and the rules that aren't obvious from the file tree.

## What this is

Marketing + booking site for **Unit 20**, a Christchurch DJ practice studio and
gear-hire house. Live at `studio.unit20.nz`. Covers the studio landing page,
online booking with payment/verification, gear-hire SEO pages, customer accounts,
and an admin dashboard.

**Scope is deliberately studio-only.** Don't reintroduce copy about shows, club
nights, or a room for hire — that's the separate Unit 20 Live ticketing site,
reached only through the "Live" link (`NEXT_PUBLIC_LIVE_URL` / `lib/site.ts`).

## Sibling projects (same laptop, `~/coding`)

| Repo | What | Relationship |
|---|---|---|
| `unit20studios` | this app — studio marketing + booking | — |
| `all-ears-crew` | All Ears Events crew-ops PWA (`crew.allears.nz`) | **same Supabase project** `abqkmovvgkrdunyrqhfp` |
| `unit20` | Unit 20 Live event ticketing (`unit20.nz`) | **unrelated stack** — FastAPI + own Postgres on EC2. Link-only. |

### The shared database — read before touching schema

This app and `all-ears-crew` are two independently-deployed frontends over **one
Supabase project**. Both businesses are run by the same owner (Will) and share
the same physical DJ decks (CDJs), which are sometimes in the studio and
sometimes out on an AV job.

Consequences you must respect:

- **`bookings` has a `BEFORE INSERT/UPDATE` trigger owned by the crew app** (crew
  migrations `0077`/`0078`, rules rewritten in `0101`) that rejects any studio
  booking on a day the decks are out. It calls `studio_gear_available(start,
  end)`, a `SECURITY DEFINER` function that sees every job but returns only a
  boolean — no job details leak here. If a booking insert fails with a
  gear-availability error, that is working as designed, not a bug. The trigger
  fires only on create or a time-window change, so status/payment updates and
  cancellations are never blocked. The API turns it into a 409 with the
  trigger's own customer-safe wording, matched on `hint === 'GEAR_BLOCKED'`.
- **What actually blocks (crew `0101`)** — a **crewed** job (never a dry hire)
  whose equipment list has **both** CDJs *and* the DJM-A9. Either one alone
  doesn't block; nor does a cable-kit row that happens to match `%cdj%`. The
  block covers **whole NZ days**, from the load-out day (`pack_in_date`) through
  the show day (`job_date`) — and deliberately stops there. A gig running
  9pm–3am packs out overnight and the gear is back before the studio opens at
  10:00, so the next day stays bookable.
- This app books as an **anonymous customer role that cannot see jobs at all**.
  Don't try to query job/crew tables from here. `/api/bookings/availability`
  greys blocked days out by calling the `studio_gear_available` RPC — a bare
  boolean, one call per day, which is exact because the block is whole-day.
- The crew app reads `bookings`, `customers`, `pricing_tiers` and
  `contact_submissions` into an admin-only Studio tab. Renaming or dropping
  columns in those tables breaks the crew app silently.
- **Supabase Auth email templates are shared with the crew app.** Both apps are
  code-based, so Magic Link and Confirm signup must both include `{{ .Token }}`,
  and the wording must stay neutral. See `docs/AUTH.md` and
  `../all-ears-crew/docs/AUTH.md`.

## Stack

Next.js 16 App Router (RSC) · React 19 · TypeScript · Tailwind v4 (CSS-first
theme in `app/globals.css`) · shadcn-style primitives · React Three Fiber + drei
(the 3D CDJ scene) · Framer Motion · Supabase · Resend + React Email · Zod +
React Hook Form · date-fns-tz (`Pacific/Auckland`) · Vercel.

> `AGENTS.md` above is not decoration: this is Next.js **16**, newer than most
> training data. Read `node_modules/next/dist/docs/` before writing App Router
> code you're inferring from memory.

```bash
npm run dev     # http://localhost:3000
npm run build   # production build — also type-checks
npm run lint
```

No test suite. `npm run build` is the check that matters. Playwright is a
devDependency but there are no committed specs.

## Design system

**`design-system/MASTER.md` is locked and wins over anything else.** Read it
before changing anything visual. Tokens are implemented in `app/globals.css`.

Short version: dark-mode only, off-black `#0A0A0A`, warm off-white text
`#F5F1EA`, single accent — washed sea green `#3DDC97`. Club/underground-adjacent,
not corporate (Resident Advisor / Boiler Room / Pirate.com references). Mono for
facts (prices, times, refs), serif for statements. Real copy, never lorem.

## Business rules (don't guess these)

**Pricing is edited, not deployed.** The whole price list is one JSON row —
`studio_settings.key = 'pricing'` (migration `0015`) — edited at
**`/admin/pricing`** and shaped by `pricingSettingsSchema` in
`lib/pricing-settings.ts`. Flat **$50+GST an hour**: $50/1h, $100/2h, with a
weekday-daytime 2-hour deal ($60+GST, Mon–Fri, session inside 10:00–16:00 NZ), a
prepaid 10-hour pack ($250+GST), and a flat surcharge for groups over 4. Every
one of those is a knob, including on/off switches for the deal, the pack and each
option card. Prices are in **cents, exclusive of GST**; UI appends "+GST".

Things to know before touching it:

- **`lib/pricing.ts` computes, it doesn't decide.** Every function takes the
  live `PricingSettings`. The constants that used to live there are now
  `DEFAULT_PRICING_SETTINGS` — a **fallback**, not the truth. If the row can't
  be read (no table, no Supabase, network), the site prices from the defaults
  and keeps taking bookings; it never fails a sale over a settings read.
- **`pricing_tiers` is a mirror now.** `writePricingSettings()` rewrites its
  label/capacity/rates on every save, because the crew app's Studio tab reads
  that table. Nothing computes a price from it any more — a price change needs
  no migration, and the two can't drift.
- **Two readers, on purpose.** `getPricingSettings()` is live (React-cached per
  request) and is what the booking API, quick-book and admin use. The marketing
  pages use `getPublicPricingSettings()`, an `unstable_cache` entry tagged
  `studio-pricing`, so `/` and `/studio/pricing` stay static on the CDN. A save
  calls `updateTag` **and** `revalidatePath` on both — miss the second and the
  landing page keeps serving last week's rate out of prerendered HTML.
- Client components never import prices; the server component that renders them
  passes `pricing` down (see `BookingFlow`).
- Copy that still hard-codes a number: `lib/legal.ts` (terms + house rules),
  `emails/BookingPostSession.tsx`, and the prose lines on `/about` and
  `/studio/the-room`. They're accurate today; a rate change means editing them.
- Longer than 2 hours is still an email enquiry — `ONLINE_MAX_DURATION_HOURS`
  is structural (slot grid, option ids), not a price knob, so it isn't editable.

**Booking states** — `status`: `pending_verification | confirmed | completed |
cancelled | no_show`. `payment_status`: `unpaid | paid | refunded | comped`.
A first-time customer's booking lands as pending until an admin marks their ID
verified; after that their bookings confirm instantly.

**Minimum notice — 4 hours on a cold day, 30 minutes once the room is open**
(`lib/booking-window.ts`, customers only). Booking closes `MIN_NOTICE_HOURS`
before a session on a day with nothing else on it: the room has to be turned
around and the gear checked, and a 12:30 booking for 1pm doesn't get that. But
the thing being protected is *opening the room*, and it's paid once — so if the
day already has a session, every start from that session onwards drops to
`WARM_DAY_NOTICE_MINUTES`. A 2pm booking means someone can take 5pm at half four.
Two knobs, one rule; don't treat the second as an exception to bolt conditions
onto.

- `dayOpensAt()` anchors on the **earliest `confirmed`/`completed` session** of
  that NZ day (`ROOM_OPENING_STATUSES`). Not `pending_verification` — that
  booking holds its slot but may never confirm, and a booking that evaporates
  never set the room up. `completed` counts because the post-session cron flips
  this morning's session to it within hours.
- The waiver can only ever fire *inside* the 4-hour window (outside it
  everything is bookable anyway), so in practice it means "the room is open or
  opens within a few hours". The generous edge: a 10am–11am session leaves the
  whole evening on 30 minutes' notice.
- Enforced twice. `/api/bookings/availability` greys the slots out and returns
  `opensAt` so the picker can say *why* late starts are open instead of
  contradicting the 4-hour line. `POST /api/bookings` re-checks against its own
  clock — it only queries the day's sessions when the start is inside the
  window at all — and answers **409**, not 422, so the flow bounces back to the
  time picker with a fresh list rather than stranding someone on review.
- **Admin quick-book deliberately checks none of it** — saying yes to a walk-in
  in twenty minutes is Will choosing to be ready, which is the whole point.
- It's a floor on lead time, not on the calendar: this morning for tonight is fine.

**ID verification** (migration `0013`, `lib/id-verification.ts`) — booking while
unverified auto-emails a one-off upload link (`/verify-id/[token]`); the customer
sends the front and back of a licence or passport; the admin sees both images on
the booking and customer pages and approves with the existing "Mark ID-verified".
Points worth knowing before changing any of it:

- **One row per customer** in `id_verifications`. Re-sending *rotates* the token
  in place, so the previous link dies — that's deliberate, and it's also how you
  kill a link that's gone astray. Only the SHA-256 of the token is stored.
- **Images live in the private `id-documents` bucket**, RLS-denied to everyone;
  the admin sees them through 5-minute signed URLs minted server-side. There is
  no unauthenticated read path.
- **Approving deletes both images.** The check is done and a folder of other
  people's ID scans is a liability; `customers.id_verified_at` is the record
  that it happened. Superseded uploads are deleted on re-submission too.
- `requestIdVerification()` never throws — an email failure must not cost
  someone their booking. Admins can always resend from either page.

**Banked hours** — the 10-hour pack banks 10 hours to the customer's account (the
first 2h session draws down immediately, leaving 8). Signed-in customers with a
balance get $0 "banked" booking options; any 5+ group surcharge is still payable
in person. Ledger + `debit_banked_hours()` in migration `0012`.

**Rewards** — every 10 hours of *completed* play mints one single-use 50%-off
code, valid on **standard sessions only**, never the 10-hour pack. Minting is
idempotent (post-session cron + manual "completed"), tracked by
`customers.rewards_granted_hours`.

**Booking creation is atomic** — `create_booking_slot()` (migration `0002`) is
race-safe. Don't hand-roll an insert path around it.

**Marking a booking PAID is what lets the customer in.** It is a send button,
not a bookkeeping flag, and it fires two separate emails:

- **The door code.** A crew-side trigger (crew `0050`) enqueues a
  `studio_door_codes` row, the `issue-studio-door-code` edge function mints it
  against the TTLock and emails it (crew `0054`). It only enqueues when the
  payment lands while the session is still ahead and the booking isn't
  cancelled — a session squared up afterwards gets **no** code, deliberately.
- **The access instructions** (`emails/BookingAccessInstructions.tsx`), sent
  once via the `access_sent_at` claim in `lib/notifications.ts`.

Both run through `runPaidAutomations()` (`lib/booking-paid.ts`), called from two
places on purpose: the `/api/hooks/booking-paid` Database Webhook (covers Xero
and the crew app's Studio tab) and `setPaymentStatus` in `app/admin/actions.ts`
(so the admin sees a result instead of trusting a webhook configured in the
Supabase dashboard and invisible from this repo). Running twice is safe.

**…but only while there is still a session to get into.** `runPaidAutomations()`
first reads `end_time`/`status` and skips the whole chain — code *and* access
email — for a finished or cancelled booking, returning `skipped`. This is the
crew door-code trigger's rule applied to the email as well: squaring up last
month's unpaid session is bookkeeping, and it used to send that customer
directions, a "your code arrives separately" line that was never true, and a
what-to-bring list for a night they had already played. The admin UI mirrors it
(no confirm step, "Mark paid" not "Mark paid & send"), `lib/automation.ts` marks
the access row `na` rather than amber, and `lib/booking-progress.ts` marks it
`skipped` rather than promising the customer an email. A send that was genuinely
*attempted* and failed still reports as a failure — `access_last_attempt_at` is
what tells those apart.

**Two readings of the same columns — don't merge them.** `lib/automation.ts` is
the *admin's* view: it exists to say "TTLock refused 3 times", "no record", "the
paid webhook isn't wired up". `lib/booking-progress.ts` is the *customer's* view
of the same booking (Booked → ID → Confirmed → Paid → How to get in → Session →
Hours added), shown on the confirmation page and under each booking on
`/account`. Merging them would mean either leaking operational failures into a
customer's inbox or blunting the admin panel. If you add a step, decide which
question it answers first.

**The account prompt is suppressed by `customers.auth_user_id`.** The
confirmation page and both booking emails offer to set up an account only when
that column is null, so it stops asking the moment someone signs up. The signup
link never carries their email in the query string — `resolveLinkedCustomer`
matches on the verified email at sign-up instead, so the history connects itself
without putting an address into logs, history and `Referer`.

`lib/automation.ts` derives the per-booking checklist behind the admin
**Automation** section. Its rule: every row is a stored timestamp or a stored row —
never inferred from booking status. Two things are genuinely unobservable and
are labelled as such rather than faked: whether an email was *delivered* (no
bounce webhook), and whether the door code was ever typed in (TTLock offline
passcodes never call back).

## Layout

```
app/(site)/      marketing + booking + customer account
app/admin/       dashboard (bookings, calendar, customers, pricing, blackouts, discounts, quick-book)
app/api/         bookings, availability, discounts, contact, cron/*, hooks/*, webhooks/xero
components/      admin/, booking/, studio/, hire/, three/, layout/, ui/, contact/, account/
lib/             pricing (+ pricing-settings/pricing-store), banked-hours, rewards,
                 discounts, timezone, ics, email, seo, xero, supabase/
emails/          React Email templates
supabase/migrations/  0001–0015 (0009, 0010 and 0014 are DO-NOT-RUN mirrors of crew 0057/0058/0124)
design-system/   MASTER.md (locked)
```

**Admin auth**: a single account — the email in `ADMIN_EMAIL`, signing in at
`/admin/login`. Created by hand in Supabase, not by the app.

**Function region — `"regions": ["hnd1"]` in `vercel.json`. Don't remove it.**
Functions run next to the database, not next to the users. Supabase is in
**ap-northeast-1 (Tokyo)**; without this, Vercel defaults to `iad1` (Washington
DC) and every query goes NZ → Sydney edge → Virginia → Tokyo and back. A page
making N sequential queries from region R costs roughly
`185ms floor + RTT(NZ→R) + N × RTT(R→Tokyo)`:

| Region | N=1 | N=3 | N=5 |
|---|---|---|---|
| `iad1` (the old default) | 555ms | 895ms | 1,235ms |
| `syd1` (nearest the users) | 295ms | 515ms | 735ms |
| **`hnd1` (with the database)** | **292ms** | **296ms** | **302ms** |

`syd1` only wins for a function making *no* database call, and there isn't one.
The real prize is the flat column: an extra sequential `await` costs ~2ms
instead of 170ms. This moves **functions only** — static marketing pages stay on
the CDN and are still served from Sydney. `vercel.json` is schema-validated and
rejects comment keys, which is why this note lives here.

**Admin auth reads the JWT, it doesn't phone home.** `proxy.ts`,
`lib/admin-auth.ts` and `lib/customer-auth.ts` use `supabase.auth.getClaims()`,
not `getUser()`. This project signs with **ES256** (see
`/auth/v1/.well-known/jwks.json`), so the token is verified locally via WebCrypto
against a JWKS cached process-globally by auth-js. `getUser()` is a network round
trip to the Auth API, and the proxy runs on *every* request to `/admin` and
`/account` — including every RSC prefetch. The trade: a session revoked
server-side stays valid until its access token expires. If you ever move this
project back to a symmetric JWT secret, `getClaims()` silently starts making the
same network call again.

**Cron** (in `vercel.json`, all guarded by `CRON_SECRET` as a bearer token):
`/api/cron/reminders` (24h-out), `/api/cron/post-session` (2h after end — marks
completed, follow-up email, mints rewards), `/api/cron/cleanup` (daily, deletes
`pending_verification` bookings older than 72h).

## Current state / known gaps

- **Xero is code-complete but OFF in production.** The four `XERO_*` env vars
  aren't set in Vercel, so the client throws "Xero API not configured" and the
  webhook can't validate signatures. Invoices are created manually for now. See
  `XERO-TODO.md` (interim state) and `docs/PLAN-xero-invoicing.md` (the full
  design for switching it on). Note the crew app has its own studio-invoicing
  path (crew migration `0057`) — check both before changing invoicing.
- **Photography is gradient placeholders** — swap to `next/image` where marked.
- **The 3D scene** falls back to a static SVG under reduced-motion, no WebGL, or
  SSR.
- Without Supabase/Resend env vars the marketing site still runs; the calendar
  shows all slots open and email/admin are disabled.
