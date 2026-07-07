-- 0009_studio_xero_invoicing.sql
-- MIRROR of crew 0057_studio_xero_invoicing.sql — applied via the crew migration
-- chain against the shared Supabase project. DO NOT run this separately; it is
-- kept here for reference so the studio repo documents its own schema (same
-- convention as studio 0006/0007 ↔ crew 0041/0029).
--
-- Adds Xero invoicing bookkeeping to the shared `bookings` table. All columns are
-- additive, nullable/defaulted, and `if not exists`-guarded. `xero_invoice_id`
-- already exists from crew 0027_studio_bridge.sql — kept idempotent.

begin;

alter table bookings add column if not exists xero_invoice_id text;
alter table bookings add column if not exists online_invoice_url text;
alter table bookings add column if not exists invoiced_at timestamptz;
alter table bookings add column if not exists paid_at timestamptz;
alter table bookings add column if not exists invoice_status text not null
  default 'not_invoiced'
  check (invoice_status in ('not_invoiced','creating','authorised','paid','voided'));

create index if not exists bookings_xero_invoice_id_idx
  on bookings (xero_invoice_id) where xero_invoice_id is not null;

commit;

-- Rollback:
--   drop index if exists bookings_xero_invoice_id_idx;
--   alter table bookings drop column if exists invoice_status;
--   alter table bookings drop column if exists paid_at;
--   alter table bookings drop column if exists invoiced_at;
--   alter table bookings drop column if exists online_invoice_url;
