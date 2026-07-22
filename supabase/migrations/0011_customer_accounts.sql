-- 0011_customer_accounts.sql
-- STUDIO-OWNED (not a crew mirror). Customer accounts + reward bookkeeping.
-- Additive + guarded: safe against the shared project (ref abqkmovvgkrdunyrqhfp).
-- auth.users is shared with the crew app — this only ADDS an optional link
-- column; admin/crew gating is unchanged (ADMIN_EMAIL / crew's own gates).

begin;

-- Link a customers row to a Supabase auth user (customer accounts). A customer
-- may exist with no account (created anonymously by a past booking); the link
-- is backfilled server-side by email match on first sign-in.
alter table customers
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
create index if not exists customers_auth_user_idx
  on customers (auth_user_id) where auth_user_id is not null;

-- Highest 10-hour play-time multiple already rewarded (idempotent minting CAS).
alter table customers
  add column if not exists rewards_granted_hours integer not null default 0;

-- Reward codes valid on standard rates only (1h / 2h / weekday-daytime) —
-- never on the 10-hour pack. Enforced server-side in the booking API.
alter table discount_codes
  add column if not exists standard_only boolean not null default false;

-- Banked hours drawn by this booking (0 = normal cash booking).
alter table bookings
  add column if not exists banked_hours_used integer not null default 0;

commit;

-- Rollback:
--   alter table bookings drop column if exists banked_hours_used;
--   alter table discount_codes drop column if exists standard_only;
--   alter table customers drop column if exists rewards_granted_hours;
--   drop index if exists customers_auth_user_idx;
--   alter table customers drop column if exists auth_user_id;
