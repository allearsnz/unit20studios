# Unit 20

Marketing + booking site for **Unit 20** — a Christchurch DJ practice studio,
gear-hire house and event venue. The home page is a two-panel hub
(**Studio / Hire** → this app, **Venue / Events** → the existing unit20.nz site).
The Studio/Hire experience covers the studio landing, online booking, gear-hire
SEO pages, and an admin dashboard.

> **Handoff note.** This is intended to be integrated into the existing
> `unit20.nz` site by that site's developer. The hub links Venue / Events out to
> `unit20.nz` for now (see `NEXT_PUBLIC_VENUE_URL` / `lib/site.ts`). The whole
> Studio/Hire app + hub can be mounted into the venue site later.

## Stack

- **Next.js 16** (App Router, TypeScript, RSC) · **React 19**
- **Tailwind CSS v4** (CSS-first theme in `app/globals.css`) + shadcn-style primitives
- **React Three Fiber** + drei — the 3D CDJ scene (`components/three/`)
- **Framer Motion** — restrained motion
- **Supabase** (Postgres + Auth) · **Resend** + **React Email** (transactional mail)
- **Zod** + **React Hook Form** · **date-fns** / **date-fns-tz** (`Pacific/Auckland`)
- **Plausible** + **GTM** + **Meta Pixel** · deploy target **Vercel**

The locked design system lives in **`design-system/MASTER.md`** — read it before
changing anything visual.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values you have
npm run dev                  # http://localhost:3000
```

Without Supabase/Resend env vars the marketing site runs fine; the booking
calendar shows all slots open, and emails/admin are disabled until configured.

## Environment variables

See **`.env.example`** for the full list. Summary:

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; bookings/admin. **Never expose.** |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` | Transactional email |
| `ADMIN_EMAIL` | The only email allowed into `/admin` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin |
| `NEXT_PUBLIC_VENUE_URL` | Where the hub's "Venue / Events" panel links (default `https://unit20.nz`) |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Shown in footer/contact (optional) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Analytics (each optional) |
| `CRON_SECRET` | Bearer token checked on `/api/cron/*` |

## Supabase setup

1. Create a Supabase project; copy the URL + anon + service-role keys into `.env.local`.
2. Apply the migrations in `supabase/migrations/` (in order) — either with the
   Supabase CLI (`supabase db push`) or by pasting each file into the SQL editor:
   - `0001_init.sql` — tables, indexes, seed pricing tiers, friendly-id counter
   - `0002_functions.sql` — `create_booking_slot()` (atomic, race-safe booking)
   - `0003_rls.sql` — RLS (public read only for tiers/blackouts; everything else server-side)
3. **Create the admin user** (post-deploy): in Supabase → Authentication → Users,
   add a user with email = your `ADMIN_EMAIL` and a password. That's the only
   account that can sign in at `/admin/login`.

## Deployment (Vercel)

1. Import the repo; set all env vars (Production + Preview).
2. The cron schedule in `vercel.json` is picked up automatically; set
   `CRON_SECRET` so the jobs authorize (Vercel sends it as `Authorization: Bearer`).
3. Point your domain at the deployment. Verify your sending domain in Resend.
4. Create the admin user in Supabase (above).

## Cron jobs

Hourly + daily, defined in `vercel.json`, all guarded by `CRON_SECRET`:

- `/api/cron/reminders` — 24h-out reminder email, once per confirmed booking
- `/api/cron/post-session` — 2h after end: marks `completed`, sends follow-up
- `/api/cron/cleanup` — daily: deletes `pending_verification` bookings older than 72h

## Admin guides

All admin lives at **`/admin`** (sign in at `/admin/login` with `ADMIN_EMAIL`).

### Verify a new customer
A first-time customer's booking lands as **Pending** (they must show ID).
1. Open the booking from the dashboard, or go to the customer via the booking.
2. In the **Customer** panel, click **Mark ID-verified** once you've seen their ID.
3. In **Actions**, click **Confirm** to move the booking to Confirmed (and, if you
   like, **Resend email** to send the confirmation). Future bookings from that
   verified customer confirm instantly.

### Add a blackout
1. Go to **Blackouts** (`/admin/blackouts`) — or "New blackout" from the dashboard.
2. Set **From** / **To** (NZ local time) and a reason (Maintenance / Event /
   Personal use / Holiday). Save.
3. Those hours immediately disappear from the public booking calendar. Delete a
   blackout with the trash icon.

### Comp a booking
1. Open the booking.
2. In the **Payment** panel, set the status to **Comped** (one click).
   Use **Refunded** if money was taken and returned, **Paid** when settled.

### Quick-book a walk-in
1. Go to **Quick book** (`/admin/quick-book`).
2. Fill name, time, duration, room and headcount. Email is optional; tick
   **Mark as paid** and/or **Email the customer** as needed. It creates an
   auto-verified customer + a confirmed booking and opens the new booking.

## Project structure

```
app/                  routes (hub at /, (site) group = marketing, admin/, api/)
components/           master-hub/, three/, booking/, admin/, layout/, ui/, contact/
emails/               React Email templates
lib/                  supabase/, pricing, timezone, validation, ics, email, seo, …
supabase/migrations/  SQL schema + RLS + functions
design-system/        MASTER.md (the locked system)
```

## Known MVP notes

- **Photography** is gradient placeholders for now (the brief had photos as a
  later step); swap to `next/image` Unsplash/real shots where marked.
- **Email copy** was authored in-house (the plan file's section 8 wasn't supplied) —
  edit in `emails/`.
- **3D scene** falls back to a static SVG under reduced-motion, no WebGL, or SSR.
- The **UI UX Pro Max** skill wasn't installed in this environment; the design
  system was built from the brief's inline spec and locked to `MASTER.md`.

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build (also type-checks)
npm run start    # serve the production build
npm run lint     # eslint
```
