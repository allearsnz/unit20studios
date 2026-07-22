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

- **Email templates** (Authentication → Email Templates):
  - *Magic Link* template must include `{{ .Token }}` — the admin/customer OTP
    flows depend on it. (Already required by the previous admin login.)
  - *Confirm signup* template must include `{{ .Token }}` so new customers get
    their 6-digit sign-up code. **Keep `{{ .ConfirmationURL }}` in the template
    too** so the crew app is unaffected.
  - Do not otherwise edit shared templates project-wide.
- **Admin user**: Authentication → Users — ensure the `ADMIN_EMAIL` user exists
  with a password.
- No Redirect-URL allow-list entries are needed — nothing here uses link-based
  redirects.

Auth is shared with the crew app. Customer sign-ups create rows in the shared
`auth.users`, but admin/crew access is gated by email/role, so a customer
account never gains admin access.
