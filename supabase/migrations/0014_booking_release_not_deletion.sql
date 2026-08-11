-- 0014_booking_release_not_deletion.sql
-- Stop the nightly cleanup silently destroying real customers' bookings.
--
-- WHAT HAPPENED. Booking U20-2026-0010 (Ethan Waitoa, Thu 13 Aug 7-9pm, 8
-- people, $110+GST) was hard-DELETED by the cleanup cron at 03:00 NZ on 10 Aug:
-- it was still `pending_verification` and more than 72h old, which is exactly
-- what that job sweeps. The customer had done nothing wrong — he booked about
-- two hours BEFORE the ID-upload link shipped, so he was never sent a way to
-- verify himself, and the reminder cron only chases `confirmed` bookings so he
-- was never nudged either. The row vanished with no admin email, no customer
-- email and no audit trail; the first anyone knew was the customer replying to
-- ask if he was still booked.
--
-- Three things were wrong, and only one of them was the 72-hour window:
--
--   1. IT DELETED. A hard delete of a customer-facing record leaves nothing to
--      inspect and nothing to restore — the only surviving evidence was in the
--      owner's inbox. `bookings` has a `cancelled` status already; releasing a
--      slot never needed to destroy the row.
--   2. IT WAS SILENT. Nobody was told, on either side.
--   3. IT SWEPT WITHOUT WARNING ANYONE. The customer got no "we still need
--      your ID" before the slot was taken back.
--
-- This migration adds the one column the cron needs to warn before it releases.
-- The behaviour change lives in app/api/cron/cleanup/route.ts.
--
-- Note the hazard was already written down in the crew repo's
-- docs/PLAN-xero-invoicing.md §8 — it flagged that this job "would silently
-- delete an invoiced-awaiting-payment booking". The invoice guard was built.
-- The "silently deletes a real booking" half was not.
--
-- Additive, reversible. Rollback at the bottom.

begin;

-- When we last told this customer we still need their ID. Null = never warned,
-- which is now a precondition for releasing the slot rather than an irrelevance.
alter table bookings
  add column if not exists verification_reminder_at timestamptz;

comment on column bookings.verification_reminder_at is
  'When the customer was last emailed asking for ID on a pending_verification booking. The cleanup cron will not release a slot it has never warned about — see 0014.';

-- The cron reads "unverified, warned long enough ago, session still ahead of
-- us"; this index covers the hot predicate without touching the rest.
create index if not exists bookings_pending_verification_idx
  on bookings (status, created_at) where status = 'pending_verification';

commit;

-- Rollback --------------------------------------------------------------------
--   begin;
--   drop index if exists bookings_pending_verification_idx;
--   alter table bookings drop column if exists verification_reminder_at;
--   commit;
-- Dropping the column makes every pending booking look un-warned, so the cron
-- would re-send one reminder each before releasing anything. That is the safe
-- direction; nothing gets released early.
