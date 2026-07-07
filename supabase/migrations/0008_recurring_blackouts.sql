-- 0055_recurring_blackouts.sql
-- Recurring (permanent) studio blackout rules for the Unit 20 studio booking
-- calendar — e.g. "block every weekday from open until 3pm". Unlike
-- blackout_periods (one-off datetime spans), these are weekly rules with no end
-- date: a set of NZ weekdays + a local-time window (minutes from midnight NZ).
-- The studio availability route expands them per requested date. Blackout info
-- isn't sensitive (it just hides public slots), so reads are public; writes are
-- service-role only (the studio admin uses the service key).
--
-- This is the AUTHORITATIVE copy (crew migration chain manages the shared
-- project abqkmovvgkrdunyrqhfp). A mirror lives at
-- unit20studios/supabase/migrations/0008_recurring_blackouts.sql for reference.
-- Additive, reversible. Rollback at the bottom.

begin;

create table if not exists recurring_blackouts (
  id uuid primary key default gen_random_uuid(),
  -- NZ-local weekdays this rule applies to: 0=Sun … 6=Sat (matches JS getDay).
  days_of_week smallint[] not null,
  -- Local-time window as minutes from NZ midnight (e.g. 600 = 10:00, 900 = 15:00).
  start_minute int not null,
  end_minute int not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint recurring_blackouts_minutes_chk
    check (start_minute >= 0 and end_minute > start_minute and end_minute <= 1440),
  constraint recurring_blackouts_days_chk
    check (array_length(days_of_week, 1) between 1 and 7)
);

alter table recurring_blackouts enable row level security;
drop policy if exists "recurring_blackouts public read" on recurring_blackouts;
create policy "recurring_blackouts public read" on recurring_blackouts
  for select using (true);

commit;

-- Rollback:
--   drop table if exists recurring_blackouts;
