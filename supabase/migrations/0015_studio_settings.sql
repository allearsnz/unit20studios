-- 0015_studio_settings.sql
-- STUDIO-OWNED. Editable pricing: the price list moves out of the code and
-- into one JSON row, so it can be changed from /admin/pricing without a deploy
-- and without a migration.
--
-- WHY. Until now a price lived in two places that had to be edited together —
-- `lib/pricing.ts` (which computed the deal, the pack and the group surcharge)
-- and the `pricing_tiers` row (which the booking API read). Changing a price
-- meant a code change AND a migration, and nothing stopped the two from
-- disagreeing quietly. `studio_settings.value` is now the single source of
-- truth; the app mirrors the headline rates back into `pricing_tiers` on every
-- save, so the crew app's Studio tab keeps reading the numbers it always has.
--
-- ALSO SETS THE NEW FLAT RATE: $50+GST an hour, so a 2-hour session is
-- $100+GST (was $80). The weekday-daytime 2-hour deal ($60+GST) and the
-- 10-hour pack ($250+GST) stay on — both are now switches in the admin panel.
--
-- Additive + guarded + reversible. Safe against the shared project
-- (ref abqkmovvgkrdunyrqhfp): a new table plus an UPDATE to the single
-- `pricing_tiers` row the studio owns.

begin;

create table if not exists studio_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table studio_settings is
  'Studio app configuration edited from /admin. One row per key; key=pricing holds the live price list (see lib/pricing-settings.ts).';

-- Deny by default. There is no customer-facing read path: prices reach the
-- browser only as props rendered by a server component, and every read/write
-- goes through the service-role key.
alter table studio_settings enable row level security;
revoke all on table studio_settings from anon, authenticated;
grant all on table studio_settings to service_role;

-- The live price list. `on conflict do nothing` so re-running this can never
-- stomp prices that have since been edited in the admin panel.
insert into studio_settings (key, value)
values (
  'pricing',
  jsonb_build_object(
    'room', jsonb_build_object(
      'label', 'Up to 8 people',
      'maxGroupSize', 8
    ),
    'rates', jsonb_build_object(
      'oneHourCents', 5000,    -- $50+GST / 1 hour
      'twoHourCents', 10000    -- $100+GST / 2 hours — flat $50/hr
    ),
    'weekdayDeal', jsonb_build_object(
      'enabled', true,
      'windowStartHour', 10,
      'windowEndHour', 16,
      'twoHourPriceCents', 6000,
      'label', 'Weekday daytime (Mon–Fri, 10am–4pm, no sub)',
      'shortNote', '(no sub)'
    ),
    'pack', jsonb_build_object(
      'enabled', true,
      'packHours', 10,
      'firstSessionHours', 2,
      'totalCents', 25000
    ),
    'groupSurcharge', jsonb_build_object(
      'threshold', 4,
      'oneHourCents', 2000,
      'twoHourCents', 3000
    ),
    'options', jsonb_build_object(
      '1h', jsonb_build_object(
        'enabled', true,
        'label', '1 hour',
        'note', 'A quick one — warm up, run your set.'
      ),
      '2h', jsonb_build_object(
        'enabled', true,
        'label', '2 hours',
        'note', 'Room to properly dig in.'
      ),
      '2h-daytime', jsonb_build_object(
        'enabled', true,
        'label', '2 hours · weekday daytime (no sub)',
        'note', 'Mon–Fri, sessions inside 10am–4pm. No sub.'
      ),
      'pack10', jsonb_build_object(
        'enabled', true,
        'label', '10-hour pack',
        'note', 'Prepay 10 hours at a lower rate. Book your first session now.'
      )
    )
  )
)
on conflict (key) do nothing;

-- Keep the mirror in step with the row above: flat $50/hr means $100+GST for
-- two hours. (The app rewrites these four columns on every save from now on.)
update pricing_tiers
   set peak_1h_price_cents = 5000,
       peak_2h_price_cents = 10000,
       max_people          = 8,
       label               = 'Up to 8 people'
 where slug = 'small';

-- Fail loudly rather than leaving the two stores disagreeing.
do $$
declare v_cents integer;
begin
  select peak_2h_price_cents into v_cents from pricing_tiers where slug = 'small';
  if v_cents is null then
    raise exception 'pricing_tiers row slug=small not found';
  elsif v_cents <> 10000 then
    raise exception 'expected peak_2h_price_cents=10000, got %', v_cents;
  end if;
  if not exists (select 1 from studio_settings where key = 'pricing') then
    raise exception 'studio_settings pricing row missing';
  end if;
end $$;

commit;

-- Rollback:
--   drop table if exists studio_settings;
--   update pricing_tiers set peak_2h_price_cents = 8000 where slug = 'small';
