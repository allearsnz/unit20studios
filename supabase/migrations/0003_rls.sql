-- Unit 20 — Row Level Security
--
-- Architecture note: all writes (bookings, customers, contact, newsletter) and
-- all PII reads go through Next.js server routes using the SERVICE ROLE key,
-- which bypasses RLS. The anon/public key is only ever used for non-sensitive
-- public reads (pricing tiers, blackout windows for the availability UI).
--
-- So we enable RLS everywhere (deny by default) and add narrow public-read
-- policies only where safe. Booking PII is never exposed to the anon key.

alter table customers            enable row level security;
alter table pricing_tiers        enable row level security;
alter table bookings             enable row level security;
alter table blackout_periods     enable row level security;
alter table contact_submissions  enable row level security;
alter table newsletter_subscribers enable row level security;
alter table booking_counters     enable row level security;

-- Public, non-sensitive reads ---------------------------------------------
drop policy if exists "pricing_tiers public read" on pricing_tiers;
create policy "pricing_tiers public read" on pricing_tiers
  for select to anon, authenticated using (true);

drop policy if exists "blackouts public read" on blackout_periods;
create policy "blackouts public read" on blackout_periods
  for select to anon, authenticated using (true);

-- Everything else: no anon policies → denied for the public key.
-- The service role bypasses RLS for all server-side operations.
