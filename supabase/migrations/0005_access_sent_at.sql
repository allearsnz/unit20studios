-- Access-instructions email tracking ---------------------------------------
-- The studio app sends a single "how to get in" email once a booking is paid.
-- `access_sent_at` makes that send idempotent: it is stamped the moment the
-- email goes out, and the sender no-ops if it is already set.
--
-- Safe to run against the shared project (project_ref abqkmovvgkrdunyrqhfp):
-- `add column if not exists` is a no-op if the column already exists.
alter table bookings
  add column if not exists access_sent_at timestamptz;
