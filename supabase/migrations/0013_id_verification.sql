-- 0013_id_verification.sql
-- STUDIO-OWNED. Remote ID checks: a customer who isn't verified yet gets a
-- one-off link after booking, uploads the front and back of a licence or
-- passport, and the admin approves it from the booking/customer panel.
--
-- `customers.id_verified` / `id_verified_at` already exist and stay the source
-- of truth — this table only carries the request and the uploaded images, so a
-- verified customer stays verified forever with nothing else to consult.
--
-- ONE ROW PER CUSTOMER. Re-sending rotates the token in place rather than
-- leaving old links alive: a licence scan is the last thing you want reachable
-- from a stale inbox. `send_count` keeps the history that the row doesn't.
--
-- Additive and safe against the shared project (ref abqkmovvgkrdunyrqhfp) —
-- the crew app doesn't read any of this. Rollback below.

begin;

create table if not exists id_verifications (
  id           uuid primary key default uuid_generate_v4(),
  customer_id  uuid not null unique references customers(id) on delete cascade,

  -- SHA-256 of the emailed token, never the token itself: a leaked database
  -- dump must not hand out working upload links.
  token_hash   text not null unique,
  expires_at   timestamptz not null,

  -- Storage keys inside the private `id-documents` bucket. Nulled when the
  -- images are deleted (on approval, or by hand).
  front_path   text,
  back_path    text,
  doc_type     text check (doc_type in ('drivers_licence', 'passport')),

  submitted_at timestamptz,
  sent_at      timestamptz,
  send_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists id_verifications_submitted_idx
  on id_verifications (submitted_at) where submitted_at is not null;

-- Deny by default. Everything here is PII and is only ever touched by the
-- service role from server routes (see 0003_rls.sql for the architecture note).
alter table id_verifications enable row level security;

-- Private bucket. Not public, so there is no unauthenticated read path at all;
-- the admin views images through short-lived signed URLs minted server-side.
-- Limits are belt-and-braces — the upload route validates type and size too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'id-documents',
  'id-documents',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created: with RLS on and no policy, anon and
-- authenticated get nothing, and the service role bypasses RLS as it does
-- everywhere else in this app.

commit;

-- Rollback:
--   delete from storage.objects where bucket_id = 'id-documents';
--   delete from storage.buckets where id = 'id-documents';
--   drop table if exists id_verifications;
