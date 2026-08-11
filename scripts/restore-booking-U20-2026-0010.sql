-- Restore Ethan Waitoa's booking, deleted by the cleanup cron on 10 Aug 2026.
--
-- Run this in the Supabase SQL editor (dashboard → SQL Editor → New query) for
-- project abqkmovvgkrdunyrqhfp. It runs as the service role there, which is
-- what create_booking_slot() requires.
--
-- WHAT IT DOES, AND WHY THIS WAY
--
-- It does NOT insert into `bookings` directly. It calls create_booking_slot(),
-- the same function the booking form and admin quick-book use, so the restore
-- gets every guard a real booking gets:
--   * the ±15-minute overlap check against active bookings — if anything has
--     taken 7-9pm since, this raises SLOT_TAKEN and writes nothing, rather than
--     quietly double-booking the room;
--   * the blackout check;
--   * the atomic per-year friendly-id sequence;
--   * the crew app's studio gear-block trigger (0077/0078/0101), which rejects
--     a studio booking on a day the CDJs are out on an AV job.
--
-- Hand-writing an INSERT would skip all four. That is worth more than
-- preserving the original reference.
--
-- WHAT YOU GET BACK, AND WHAT YOU DON'T
--
-- The booking comes back with the same customer, slot, size, price and status.
-- It gets a NEW friendly id — U20-2026-0012 or whatever is next — because
-- booking_counters.last_seq only ever moves forward and 0010 is spent. The old
-- reference is written into customer_note so the two connect on paper.
--
-- SAFE TO RUN TWICE: step 1 aborts if an active booking already covers that
-- slot, so a second run does nothing rather than creating a duplicate.

do $$
declare
  v_customer   uuid;
  v_tier       uuid;
  v_start      timestamptz := timestamptz '2026-08-13 19:00:00 Pacific/Auckland';
  v_end        timestamptz := timestamptz '2026-08-13 21:00:00 Pacific/Auckland';
  v_booking    bookings;
  v_clash      int;
begin
  -- 1. Is the slot genuinely still free? create_booking_slot() checks this too;
  --    doing it here first turns a raised exception into a clear message.
  select count(*) into v_clash
    from bookings b
   where b.status in ('pending_verification', 'confirmed')
     and tstzrange(b.start_time - interval '15 minutes',
                   b.end_time   + interval '15 minutes', '[)')
         && tstzrange(v_start, v_end, '[)');
  if v_clash > 0 then
    raise exception
      'Nothing done: % active booking(s) already overlap Thu 13 Aug 7-9pm. Check the calendar before restoring.',
      v_clash;
  end if;

  -- 2. The customer row survived — the cron deletes bookings, not customers.
  select id into v_customer from customers where lower(email) = 'ethan.waitoa@gmail.com';
  if v_customer is null then
    raise exception
      'Nothing done: no customer with that email. Create the customer first, then re-run.';
  end if;

  -- 3. The tier that covers 8 people. max_people is the capacity band; there is
  --    one tier today (up to 8), so this is unambiguous, but order defensively.
  select id into v_tier
    from pricing_tiers
   where max_people >= 8
   order by max_people, sort_order
   limit 1;
  if v_tier is null then
    raise exception 'Nothing done: no pricing tier covers a group of 8.';
  end if;

  -- 4. Recreate it. 11000 cents ex-GST is the figure from the confirmation
  --    email: $80 base for 2h + $30 group surcharge = $110 + GST = $126.50.
  --    is_peak false — 7pm Thursday is standard evening, not a peak rate.
  --    Status stays pending_verification: he still has not sent ID, and
  --    pretending otherwise would skip a check the business actually wants.
  v_booking := create_booking_slot(
    p_customer_id       => v_customer,
    p_start             => v_start,
    p_end               => v_end,
    p_duration_hours    => 2,
    p_pricing_tier_id   => v_tier,
    p_group_size        => 8,
    p_total_price_cents => 11000,
    p_is_peak           => false,
    p_status            => 'pending_verification',
    p_source            => 'direct',
    p_customer_note     => 'Restored 11 Aug 2026. Original booking U20-2026-0010 '
                        || '(f785f717-202a-4510-9337-61eaf0f4b7fc) was deleted by the '
                        || 'cleanup cron while awaiting ID; the customer had never been '
                        || 'sent an upload link. Same customer, slot, size and price.'
  );

  raise notice 'Restored as % — % to %, % people, $% + GST',
    v_booking.friendly_id,
    to_char(v_booking.start_time at time zone 'Pacific/Auckland', 'Dy DD Mon HH24:MI'),
    to_char(v_booking.end_time   at time zone 'Pacific/Auckland', 'HH24:MI'),
    v_booking.group_size,
    (v_booking.total_price_cents / 100.0);
  raise notice 'NEXT: send him the ID upload link, or mark him verified. He is still pending.';
end $$;
