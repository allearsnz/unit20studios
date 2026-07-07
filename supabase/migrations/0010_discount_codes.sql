-- 0010_discount_codes.sql
-- MIRROR of crew 0058_discount_codes.sql — applied via the crew migration chain
-- against the shared Supabase project. DO NOT run this separately; it is kept
-- here for reference so the studio repo documents its own schema (same
-- convention as studio 0006/0007/0009 ↔ crew 0041/0029/0057).
--
-- Percentage discount codes: emailed from a booking (single-use, 60-day expiry),
-- auto-applied + redeemed server-side on the next booking, and managed from the
-- admin "Discounts" tab (manual + reusable campaign codes). Adds a
-- `discount_codes` table and two `bookings` columns. All additive, guarded,
-- reversible. RLS restrictive (no anon policies) — validation/redemption happen
-- server-side via the service-role key.

begin;

create table if not exists discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- stored UPPERCASE
  percent     int  not null check (percent between 1 and 100),
  status      text not null default 'active'
    check (status in ('active','disabled','expired')),
  max_uses    int  default 1,                        -- null = unlimited
  used_count  int  not null default 0,
  expires_at  timestamptz,                           -- null = no expiry
  customer_id uuid references customers(id),         -- who it was sent to (nullable)
  booking_id  uuid references bookings(id),          -- the booking it came from (nullable)
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists discount_codes_code_idx on discount_codes (code);
create index if not exists discount_codes_customer_idx
  on discount_codes (customer_id) where customer_id is not null;

drop trigger if exists discount_codes_set_updated_at on discount_codes;
create trigger discount_codes_set_updated_at
  before update on discount_codes
  for each row execute function set_updated_at();

alter table discount_codes enable row level security;

alter table bookings add column if not exists discount_code_id uuid references discount_codes(id);
alter table bookings add column if not exists discount_amount_cents int not null default 0;

-- Atomic single-statement redemption (see crew 0058 for the full rationale):
-- claims one use iff still redeemable, expiring the code at its cap. Returns
-- true only for the winning caller. Service-role only.
create or replace function redeem_discount_code(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update discount_codes
    set used_count = used_count + 1,
        status = case
          when max_uses is not null and used_count + 1 >= max_uses then 'expired'
          else status
        end
    where id = p_id
      and status = 'active'
      and (expires_at is null or expires_at > now())
      and (max_uses is null or used_count < max_uses);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function redeem_discount_code(uuid) from public, anon, authenticated;
grant execute on function redeem_discount_code(uuid) to service_role;

commit;

-- Rollback:
--   drop function if exists redeem_discount_code(uuid);
--   alter table bookings drop column if exists discount_amount_cents;
--   alter table bookings drop column if exists discount_code_id;
--   drop table if exists discount_codes;
