# Auth — admin + customer accounts

Two authenticated surfaces share one Supabase project (also used by the All Ears
crew app). Both avoid redirect-based auth (magic links / OAuth) because a
redirect can fall back to the shared **Site URL** and bounce the user into the
wrong app. Everything here establishes the session **in-place** — no
`/auth/callback`, no redirect-allow-list matching.

## Admin (`/admin`) — email + password

1. `app/admin/login/page.tsx` — email + password form; calls
   `supabase.auth.signInWithPassword`, then does a full navigation to `/admin`
   (so `proxy.ts` picks up the fresh session cookie).
2. `proxy.ts` + `lib/admin-auth.ts` gate `/admin/*` by matching the session
   email against `ADMIN_EMAIL` — unchanged, auth-method agnostic.

The admin auth user already exists with a password (see README → Supabase
setup). Forgot it? Reset it at `/account/forgot` (the OTP reset flow works for
any auth user, including the admin) or from the Supabase dashboard.

## Customer accounts (`/account`) — email + password, OTP-verified sign-up

- **Sign up** (`/account/signup`): name + email + password → a 6-digit code is
  emailed (`signInWithOtp`, `shouldCreateUser: true`) → `verifyOtp` establishes
  the session in-place → `updateUser({ password, data: { name } })` sets the
  password. Verifying the email *before* the account can read an existing
  customer's booking history is deliberate (that history is PII).
- **Sign in** (`/account/login`): `signInWithPassword`.
- **Forgot** (`/account/forgot`): email → OTP code → new password
  (`verifyOtp` + `updateUser`). Works for the admin user too.
- `proxy.ts` guards `/account/*` for ANY signed-in session. The `customers` row
  is linked server-side by `lib/customer-auth.ts` (`resolveLinkedCustomer`):
  first by `auth_user_id`, else by verified-email match (then backfilled). A
  customer with past anonymous bookings connects automatically on first sign-in.
- All dashboard reads use the **service-role** client scoped to the signed-in
  user's `customer_id` — consistent with the rest of the app (no new
  `auth.uid()` RLS policies).

## Supabase dashboard — one-time setup

- **Email templates** (Authentication → Email Templates). There is ONE shared
  set for the whole project (one GoTrue instance) — the same templates serve
  both the studio and the crew app, so keep the wording **neutral** (no crew- or
  studio-specific "backend" language).
  - *Magic Link* template must include `{{ .Token }}` — the admin/customer OTP
    login + password-reset flows depend on it.
  - *Confirm signup* template must include `{{ .Token }}` so new customers get
    their 6-digit sign-up code.
  - Both apps are code-based (nobody clicks the emailed link), so
    `{{ .ConfirmationURL }}` / `{{ .SiteURL }}` can be **removed** — a code-only
    template is fine. (Only keep the URL if some crew flow still confirms an
    account by clicking the link — verify before stripping it.)
  - Suggested neutral body: `Your verification code is {{ .Token }} — enter it
    to continue. If you didn't request this, ignore this email.`
- **Admin user**: Authentication → Users — ensure the `ADMIN_EMAIL` user exists
  with a password.
- No Redirect-URL allow-list entries are needed — nothing here uses link-based
  redirects.

Auth is shared with the crew app: one `auth.users` table and one set of auth
(code) emails. That is the ONLY shared surface — studio customers can't reach
crew dashboards/data (gated by domain + `ADMIN_EMAIL`/role), and all rich studio
mail (welcome, bookings, rewards) is sent separately + Unit-20-branded via Resend
(`lib/email.ts`), never through GoTrue.
