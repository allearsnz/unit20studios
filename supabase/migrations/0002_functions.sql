-- Unit 20 — atomic booking creation
-- Generates the friendly id and inserts the booking inside one transaction,
-- after re-checking for overlap (existing active booking ±15min buffer, or any
-- blackout). Raises 'SLOT_TAKEN' so the API can return a clean error to the
-- client when a slot is grabbed between availability check and submit.

create or replace function create_booking_slot(
  p_customer_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_duration_hours integer,
  p_pricing_tier_id uuid,
  p_group_size integer,
  p_total_price_cents integer,
  p_is_peak boolean,
  p_status text,
  p_source text,
  p_customer_note text
) returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from (p_start at time zone 'Pacific/Auckland'))::int;
  v_seq integer;
  v_friendly text;
  v_booking bookings;
begin
  -- 15-minute buffer around existing active bookings
  if exists (
    select 1 from bookings b
    where b.status in ('pending_verification', 'confirmed')
      and tstzrange(b.start_time - interval '15 minutes',
                    b.end_time   + interval '15 minutes', '[)')
          && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  -- blackout periods
  if exists (
    select 1 from blackout_periods bp
    where tstzrange(bp.start_time, bp.end_time, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  -- atomic per-year sequence
  insert into booking_counters (year, last_seq)
    values (v_year, 1)
    on conflict (year) do update set last_seq = booking_counters.last_seq + 1
    returning last_seq into v_seq;

  v_friendly := 'U20-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into bookings (
    friendly_id, customer_id, start_time, end_time, duration_hours,
    pricing_tier_id, group_size, total_price_cents, is_peak, status,
    source, customer_note
  ) values (
    v_friendly, p_customer_id, p_start, p_end, p_duration_hours,
    p_pricing_tier_id, p_group_size, p_total_price_cents, p_is_peak, p_status,
    p_source, p_customer_note
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Only the server (service role) calls this.
revoke all on function create_booking_slot from public, anon, authenticated;
grant execute on function create_booking_slot to service_role;
