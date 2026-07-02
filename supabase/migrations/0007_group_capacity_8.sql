-- Studio: the room now takes groups of up to 8 online (was capped at 4 with
-- an "over 4 -> get in touch" gate). Groups of 5-8 pay a flat surcharge that
-- is applied in APPLICATION CODE, not stored here: +$20+GST on a 1-hour
-- booking, +$30+GST on a 2-hour booking (the 10-hour pack's first 2h session
-- counts as 2 hours). Base rates are unchanged.
-- The tier label follows the new capacity (it shows as the "Room" line on
-- the confirmation page and in admin views).
update pricing_tiers
set max_people = 8,
    label      = 'Up to 8 people'
where slug = 'small';

-- Fail the migration loudly if the expected row wasn't updated.
do $$
declare v integer;
begin
  select max_people into v from pricing_tiers where slug = 'small';
  if v is null then
    raise exception 'pricing_tiers row slug=small not found';
  elsif v <> 8 then
    raise exception 'expected max_people=8, got %', v;
  end if;
end $$;
