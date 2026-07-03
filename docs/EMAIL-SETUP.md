# Email setup

## Transactional emails (Resend)

All customer/admin transactional emails live in `emails/*.tsx` (shared pieces
in `emails/components/EmailLayout.tsx`) and are sent via Resend from
`studio@unit20.nz` (`lib/email.ts`). They share one branded system:

- **Wordmark is text, not an image** — `unit/20` rendered with
  `font-family: 'PP Supply Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`.
  The licensed PP Supply Mono file is deliberately **not** embedded; clients
  without it fall back to a system mono. No external images anywhere.
- Brand tokens mirror `app/globals.css`: bg `#0a0a0a`, panels `#141414`,
  text `#f5f1ea`, muted `#8a8580`, accent `#3ddc97`, hairline `#262624`.

## Supabase Auth sign-in code email (Magic Link template)

The studio admin login verifies a **6-digit code**, but Supabase's default
"Magic Link" email only sends a link. The branded replacement is
[`docs/supabase-auth-code-email.html`](./supabase-auth-code-email.html) — it
shows `{{ .Token }}` (the code) prominently, with a small
`{{ .ConfirmationURL }}` link as a fallback.

**To install:**

1. Open the Supabase Dashboard → **Authentication** → **Email Templates**.
2. Select the **Magic Link** template.
3. Paste the entire contents of `docs/supabase-auth-code-email.html` into the
   body field (replace what's there). Set the subject to something like
   `Your Unit 20 sign-in code`.
4. **Save.**

> Note: this is a **shared Supabase project**, so the template also styles the
> crew app's auth email. That's fine — it's the same brand.

## TODO (later)

Switch the **CREW app** sign-in to a one-time **code** (`verifyOtp`) sent from
`studio@unit20.nz` as well, reusing this same Resend/SMTP infrastructure —
same code-first email template. Not done in this pass; crew sign-in is
deliberately untouched.
