# Auth — studio admin

The studio admin (`/admin`) uses **passwordless magic-link sign-in**. There is no password.

## How it works

1. `app/admin/login/page.tsx` — email-only form; calls `supabase.auth.signInWithOtp` with
   `emailRedirectTo: <origin>/auth/callback?next=/admin` and `shouldCreateUser: false`.
2. `app/auth/callback/route.ts` — exchanges the PKCE `?code=` for a session cookie and
   redirects to `/admin`. On failure it redirects to `/admin/login?e=auth`.
3. `proxy.ts` + `lib/admin-auth.ts` gate `/admin/*` by matching the session email against
   `ADMIN_EMAIL` — auth-method agnostic, unchanged.

PKCE magic links must be **opened in the same browser** that requested them (the code
verifier lives in that browser's storage).

Auth is shared with the All Ears crew app (same Supabase project). Do **not** edit the
Magic Link email template project-wide — it would break the crew app.

## Supabase dashboard — Redirect URLs (Authentication → URL Configuration)

These must be in the allow-list or the link falls back to the Site URL:

- `https://studio.unit20.nz/auth/callback`
- the `*.vercel.app` deployment URL + `/auth/callback`
- `http://localhost:3000/**`

## FUTURE

Optionally add password sign-in as a fallback (set a password via
`supabase.auth.updateUser` or the dashboard, then re-add a password field). See
`app/admin/login/page.tsx` and `app/auth/callback/route.ts`.
