-- Unit 20 — new flat pricing model (July 2026)
--
-- 1 hour  = $50 + GST  (unchanged, 5000 cents ex-GST)
-- 2 hours = $80 + GST  (standard — was $75+GST / 7500 cents)
-- 2 hours = $60 + GST  weekday daytime (Mon–Fri, session inside 10:00–16:00 NZ)
--
-- The weekday-daytime $60 rate is computed IN CODE from the booking start
-- time (lib/pricing.ts isWeekdayDaytime / calcPriceCents) and is deliberately
-- not stored here — this table only carries the standard rates that
-- calcPriceCents falls back to.
--
-- NOTE: apply manually (supabase db push) — not auto-applied on deploy.

update pricing_tiers
  set peak_1h_price_cents = 5000,   -- $50 ex-GST / 1h (unchanged, asserted)
      peak_2h_price_cents = 8000    -- $80 ex-GST / 2h standard (was 7500)
  where slug = 'small';
