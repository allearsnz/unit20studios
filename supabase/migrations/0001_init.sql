-- Unit 20 — initial schema
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- customers ----------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  name text not null,
  phone text not null,
  dob date not null,
  id_verified boolean not null default false,
  id_verified_at timestamptz,
  marketing_opt_in boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pricing tiers (seeded) ---------------------------------------------------
create table if not exists pricing_tiers (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  label text not null,
  max_people integer not null,
  peak_1h_price_cents integer not null,
  peak_2h_price_cents integer not null,
  peak_extra_hour_price_cents integer not null,
  off_peak_multiplier numeric not null default 0.70,
  sort_order integer not null default 0
);

-- bookings -----------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  friendly_id text not null unique,                    -- e.g. U20-2026-0042
  customer_id uuid not null references customers(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_hours integer not null,
  pricing_tier_id uuid not null references pricing_tiers(id),
  group_size integer not null,
  total_price_cents integer not null,
  is_peak boolean not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification','confirmed','completed','cancelled','no_show')),
  payment_method text not null default 'in_person'
    check (payment_method in ('in_person','stripe')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded','comped')),
  stripe_payment_intent_id text,
  source text,
  customer_note text,
  internal_note text,
  reminder_sent_at timestamptz,
  post_session_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists bookings_start_time_idx on bookings (start_time);
create index if not exists bookings_status_idx on bookings (status);
create index if not exists bookings_friendly_id_idx on bookings (friendly_id);
create index if not exists bookings_customer_idx on bookings (customer_id);

-- blackout periods ---------------------------------------------------------
create table if not exists blackout_periods (
  id uuid primary key default uuid_generate_v4(),
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists blackout_start_idx on blackout_periods (start_time);

-- contact form submissions -------------------------------------------------
create table if not exists contact_submissions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  source_page text,
  ip_address text,
  created_at timestamptz not null default now()
);

-- newsletter subscribers (phase 2 placeholder) -----------------------------
create table if not exists newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- per-year sequence for friendly booking ids (atomic) ----------------------
create table if not exists booking_counters (
  year integer primary key,
  last_seq integer not null default 0
);

-- updated_at maintenance ---------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists customers_updated_at on customers;
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- seed pricing tiers -------------------------------------------------------
insert into pricing_tiers
  (slug, label, max_people, peak_1h_price_cents, peak_2h_price_cents, peak_extra_hour_price_cents, sort_order)
values
  ('small', 'Up to 5 people', 5, 5000, 9000, 3000, 1),
  ('large', '6 to 10 people', 10, 7000, 12500, 5000, 2)
on conflict (slug) do nothing;
