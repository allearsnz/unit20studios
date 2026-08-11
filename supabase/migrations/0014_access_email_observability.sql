-- 0014_access_email_observability.sql
-- MIRROR of crew 0124_studio_access_email_observability.sql — applied via the
-- crew migration chain against the shared Supabase project. DO NOT run this
-- separately; it is kept here so the studio repo documents its own schema (same
-- convention as studio 0009 ↔ crew 0057, 0006/0007 ↔ crew 0041/0029).
--
-- WHY. `access_sent_at` (studio 0005) is a *claim*, not a record: the sender
-- stamps it before sending and rolls it back to null if Resend refuses. That is
-- the right retry behaviour and the wrong audit trail — after a failure the row
-- is identical to a booking nobody ever tried to email, and identical again to
-- one where the paid Database Webhook never fired at all. The admin marking a
-- booking paid could not tell "sent", "failed" and "nothing ever ran" apart.
--
-- These three columns split them. `access_last_attempt_at` is stamped on every
-- genuine attempt and NEVER rolled back, so on a paid booking:
--
--   sent_at set                          -> it went (that is the success stamp)
--   sent_at null, last_attempt_at set    -> we tried and failed; see error
--   sent_at null, last_attempt_at null   -> nothing ever fired. Check the
--                                           bookings paid Database Webhook.
--
-- Read by lib/automation.ts, written by lib/notifications.ts.

begin;

alter table bookings
  add column if not exists access_last_attempt_at timestamptz,
  add column if not exists access_send_error      text,
  add column if not exists access_send_attempts   integer not null default 0;

commit;

-- Rollback:
--   alter table bookings drop column if exists access_send_attempts;
--   alter table bookings drop column if exists access_send_error;
--   alter table bookings drop column if exists access_last_attempt_at;
