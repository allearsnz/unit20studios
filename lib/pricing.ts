import type { PricingTier } from "./types";

/**
 * One bookable tier: flat hourly rate for groups up to 4. Larger groups or
 * sessions longer than 2 hours go through email (see BULK_PACK + FLAT_LIMITS).
 * Prices are stored in cents, EXCLUSIVE of GST. UI appends "+GST".
 */
export const FLAT_TIER: Omit<PricingTier, "id"> = {
  slug: "small",
  label: "Up to 4 people",
  max_people: 4,
  peak_1h_price_cents: 5000,   // $50+GST / 1 hour
  peak_2h_price_cents: 7500,   // $75+GST / 2 hours
  peak_extra_hour_price_cents: 0, // not bookable online; enquire
  off_peak_multiplier: 1.0,    // flat rate, no peak / off-peak
  sort_order: 1,
};

/**
 * Marketing-only bulk pack: $25+GST/hr when you prepay 10 hours. Handled by
 * email, not the online booking flow.
 */
export const BULK_PACK = {
  hourlyCents: 2500,           // $25+GST / hr
  packHours: 10,               // prepaid block
  totalCents: 25000,           // $250+GST
} as const;

/**
 * Hard caps for the online booking flow.
 * Anything outside these gets routed to /contact with a prefilled subject.
 */
export const FLAT_LIMITS = {
  maxDurationHours: 2,
  maxGroupSize: 4,
} as const;

export const PRICING_TIERS: Omit<PricingTier, "id">[] = [FLAT_TIER];

/**
 * Price in cents (ex-GST) for the flat tier. `isPeak` is accepted for backward
 * compatibility but ignored — pricing is flat.
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
  _isPeak?: boolean,
): number {
  if (durationHours <= 1) return tier.peak_1h_price_cents;
  if (durationHours === 2) return tier.peak_2h_price_cents;
  // 3+ hours not bookable online; if ever called with one (e.g. admin quick
  // book), fall back to 2h + (extra hours * 1h). Admin can override on the
  // booking record after.
  return (
    tier.peak_2h_price_cents + (durationHours - 2) * tier.peak_1h_price_cents
  );
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

/** "$50+GST" from cents. */
export function formatNZDPlusGst(cents: number): string {
  return `${nzd.format(cents / 100)}+GST`;
}

/** Split currency for the mono pricing display (symbol/amount weighted apart). */
export function priceParts(cents: number): { symbol: string; amount: string } {
  return { symbol: "$", amount: (cents / 100).toFixed(2) };
}
