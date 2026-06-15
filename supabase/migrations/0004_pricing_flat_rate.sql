-- Unit 20 — flat-rate pricing
--
-- Drops the peak/off-peak tiered model.
-- One bookable tier: "Up to 4 people" at $50+GST/hr or $75+GST/2h.
-- Bigger groups (5+) and longer sessions (3h+) go via email enquiry.
-- A discounted bulk pack ($25+GST/hr × 10 hours prepaid) is sold offline.

-- Reset the small tier to the new flat rate
update pricing_tiers
  set label = 'Up to 4 people',
      max_people = 4,
      peak_1h_price_cents = 5000,            -- $50 ex-GST
      peak_2h_price_cents = 7500,            -- $75 ex-GST
      peak_extra_hour_price_cents = 0,       -- not bookable online
      off_peak_multiplier = 1.0              -- flat: no peak/off-peak
  where slug = 'small';

-- Retire the legacy "6 to 10 people" tier. We do NOT drop the row because
-- `bookings.pricing_tier_id` references it (preserves any historical bookings
-- created while it was live). Renaming it makes its retirement obvious in the
-- admin/Supabase UI.
update pricing_tiers
  set label = '[retired] 6 to 10 people',
      sort_order = 99
  where slug = 'large';
