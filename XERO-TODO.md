# Xero integration — deferred (manual invoicing for now)

**Status:** Code is in the repo but **not active in production**. For now, invoices are
created **manually** in Xero from each booking's details. Leave the integration as-is until
we're ready to switch it on.

## What exists in code
- `lib/xero.ts` — Xero API client / payment reconciliation helpers.
- `app/api/webhooks/xero/route.ts` — webhook that flips a booking's `payment_status` to
  `paid` when Xero reports a matching payment (which then triggers the access-instructions
  email via `app/api/hooks/booking-paid/route.ts`).

## Why it's off
The four required environment variables are **not set in Vercel**, so the client throws
"Xero API not configured" and the webhook can't validate signatures. Until these are set,
the automated Xero → paid → access-email path does nothing.

## To turn it on later
1. Add these env vars to the Vercel `unit20studios` project (Production, and Preview if used):
   - `XERO_CLIENT_ID`
   - `XERO_CLIENT_SECRET`
   - `XERO_TENANT_ID`
   - `XERO_WEBHOOK_KEY`
2. In the Xero developer portal, point the webhook at
   `https://studio.unit20.nz/api/webhooks/xero` and use the same `XERO_WEBHOOK_KEY`.
3. Redeploy, then test with a real (or sandbox) payment and confirm the booking flips to
   `paid` and the access-instructions email sends.
4. Before relying on the access email, replace the placeholder entry text in
   `emails/BookingAccessInstructions.tsx` with the real door/keypad instructions.

## Until then
- Create invoices manually in Xero from the booking details shown in `/admin`.
- Mark payment status manually in the admin panel when paid.
