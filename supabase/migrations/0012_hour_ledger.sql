-- 0012_hour_ledger.sql
-- STUDIO-OWNED. Append-only banked-hours ledger + atomic debit RPC.
-- Balance = sum(delta_hours). Credits are plain service-role inserts;
-- debits go through debit_banked_hours() so the balance can never go negative
-- (mirrors the redeem_discount_code pattern). RLS deny-by-default.

begin;

create table if not exists hour_ledger (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id) on delete cascade,
  delta_hours  integer not null check (delta_hours <> 0),
  reason       text not null
    check (reason in ('pack_purchase','session_used','session_refund','adjustment')),
  booking_id   uuid references bookings(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists hour_ledger_customer_idx on hour_ledger (customer_id);

alter table hour_ledger enable row level security;
-- No policies: anon/authenticated denied. Service role only, like bookings.

-- Atomic debit: serializes per customer (row lock), re-checks the balance,
-- inserts the negative entry. Returns the new ledger row id, or null when the
-- balance is insufficient. Service-role only.
create or replace function debit_banked_hours(
  p_customer_id uuid,
  p_hours integer,
  p_booking_id uuid default null,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_id uuid;
begin
  if p_hours is null or p_hours <= 0 then
    return null;
  end if;

  -- Serialize concurrent debits for this customer.
  perform 1 from customers where id = p_customer_id for update;

  select coalesce(sum(delta_hours), 0) into v_balance
    from hour_ledger where customer_id = p_customer_id;

  if v_balance < p_hours then
    return null;
  end if;

  insert into hour_ledger (customer_id, delta_hours, reason, booking_id, note)
    values (p_customer_id, -p_hours, 'session_used', p_booking_id, p_note)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function debit_banked_hours(uuid, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function debit_banked_hours(uuid, integer, uuid, text)
  to service_role;

commit;

-- Rollback:
--   drop function if exists debit_banked_hours(uuid, integer, uuid, text);
--   drop table if exists hour_ledger;
