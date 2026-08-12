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

**Pricing** — one tier, groups up to 8. $50+GST/1h, $80+GST/2h. Prices are stored
in **cents, exclusive of GST**; UI appends "+GST". A weekday-daytime deal makes a
2-hour session that sits entirely inside Mon–Fri 10:00–16:00 NZ $60+GST — computed
**in code** (`WEEKDAY_DAYTIME_DEAL` in `lib/pricing.ts`), deliberately not stored
in `pricing_tiers`. Groups of 5–8 add a flat surcharge. Longer sessions go through
email, not online booking.

> The live booking API reads the tier from the `pricing_tiers` **table**, so a
> price change in `lib/pricing.ts` must ship with a matching migration.

**Booking states** — `status`: `pending_verification | confirmed | completed |
cancelled | no_show`. `payment_status`: `unpaid | paid | refunded | comped`.
A first-time customer's booking lands as pending until an admin marks their ID
verified; after that their bookings confirm instantly.

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

`lib/automation.ts` derives the per-booking checklist behind the admin
**Automation** tab. Its rule: every row is a stored timestamp or a stored row —
never inferred from booking status. Two things are genuinely unobservable and
are labelled as such rather than faked: whether an email was *delivered* (no
bounce webhook), and whether the door code was ever typed in (TTLock offline
passcodes never call back).

## Layout

```
app/(site)/      marketing + booking + customer account
app/admin/       dashboard (bookings, calendar, customers, blackouts, discounts, quick-book)
app/api/         bookings, availability, discounts, contact, cron/*, hooks/*, webhooks/xero
components/      admin/, booking/, studio/, hire/, three/, layout/, ui/, contact/, account/
lib/             pricing, banked-hours, rewards, discounts, timezone, ics, email, seo, xero, supabase/
emails/          React Email templates
supabase/migrations/  0001–0014 (0009 and 0014 are DO-NOT-RUN mirrors of crew 0057/0124)
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
