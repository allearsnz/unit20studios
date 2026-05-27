import type { PricingTier } from "./types";

/**
 * Canonical tier values, mirroring the DB seed (supabase/migrations/0001_init).
 * Used for marketing/pricing display so those pages don't depend on a DB call.
 * The booking API re-validates against the DB at submit time.
 */
export const PRICING_TIERS: Omit<PricingTier, "id">[] = [
  {
    slug: "small",
    label: "Up to 5 people",
    max_people: 5,
    peak_1h_price_cents: 5000,
    peak_2h_price_cents: 9000,
    peak_extra_hour_price_cents: 3000,
    off_peak_multiplier: 0.7,
    sort_order: 1,
  },
  {
    slug: "large",
    label: "6 to 10 people",
    max_people: 10,
    peak_1h_price_cents: 7000,
    peak_2h_price_cents: 12500,
    peak_extra_hour_price_cents: 5000,
    off_peak_multiplier: 0.7,
    sort_order: 2,
  },
];

/**
 * Price a session in cents.
 *  1h  → peak_1h
 *  2h  → peak_2h
 *  >2h → peak_2h + (hours - 2) * extra_hour
 * Off-peak applies the tier multiplier (default 0.70) to the whole total.
 */
export function calcPriceCents(
  tier: Pick<
    PricingTier,
    | "peak_1h_price_cents"
    | "peak_2h_price_cents"
    | "peak_extra_hour_price_cents"
    | "off_peak_multiplier"
  >,
  durationHours: number,
  isPeak: boolean,
): number {
  let base: number;
  if (durationHours <= 1) base = tier.peak_1h_price_cents;
  else if (durationHours === 2) base = tier.peak_2h_price_cents;
  else base = tier.peak_2h_price_cents + (durationHours - 2) * tier.peak_extra_hour_price_cents;

  if (!isPeak) base = Math.round(base * Number(tier.off_peak_multiplier));
  return base;
}

const nzd = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
});

/** "$90.00" from cents. */
export function formatNZD(cents: number): string {
  return nzd.format(cents / 100);
}

/** Split currency for the mono pricing display (symbol/amount weighted apart). */
export function priceParts(cents: number): { symbol: string; amount: string } {
  return { symbol: "$", amount: (cents / 100).toFixed(2) };
}
