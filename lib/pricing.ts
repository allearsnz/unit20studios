import { formatInTimeZone } from "date-fns-tz";
import { NZ_TZ } from "./timezone";
import type { PricingTier } from "./types";

/**
 * One bookable tier: groups up to 4, sessions of 1 or 2 hours online.
 * $50+GST for 1 hour, $80+GST for 2 hours — with a weekday-daytime deal
 * (see WEEKDAY_DAYTIME_DEAL) that makes qualifying 2-hour sessions $60+GST.
 * Larger groups or longer sessions go through email (BULK_PACK + FLAT_LIMITS).
 * Prices are stored in cents, EXCLUSIVE of GST. UI appends "+GST".
 *
 * NOTE: the live booking API reads this tier from the `pricing_tiers` table,
 * so price changes here must ship with a matching supabase migration.
 */
export const FLAT_TIER: Omit<PricingTier, "id"> = {
  slug: "small",
  label: "Up to 4 people",
  max_people: 4,
  peak_1h_price_cents: 5000,   // $50+GST / 1 hour
  peak_2h_price_cents: 8000,   // $80+GST / 2 hours (standard)
  peak_extra_hour_price_cents: 0, // not bookable online; enquire
  off_peak_multiplier: 1.0,    // flat rate; the weekday deal is computed in code
  sort_order: 1,
};

/**
 * Weekday-daytime deal: a 2-hour session that sits entirely inside
 * Mon–Fri 10:00–16:00 NZ time (Pacific/Auckland) is $60+GST instead of the
 * standard $80+GST. Because the whole session must fit in the window, that
 * means a weekday start between 10:00 and 14:00. Computed in code from the
 * booking start time — deliberately NOT stored in `pricing_tiers`.
 */
export const WEEKDAY_DAYTIME_DEAL = {
  windowStartHour: 10, // window opens 10:00 NZ
  windowEndHour: 16,   // session must END by 16:00 NZ
  twoHourPriceCents: 6000, // $60+GST / 2 hours
  label: "Weekday daytime (Mon–Fri, 10am–4pm)",
} as const;

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
 * True when a session starting at `start` and running `durationHours` sits
 * entirely inside the weekday-daytime window: Mon–Fri, 10:00–16:00
 * Pacific/Auckland. For the 2-hour deal that means a weekday start between
 * 10:00 and 14:00 inclusive. (Sessions never cross midnight — the studio runs
 * 07:00–24:00 — and NZ DST switches at 2–3am, so plain wall-clock arithmetic
 * is safe here.)
 */
export function isWeekdayDaytime(
  start: Date | string | number,
  durationHours = 2,
): boolean {
  const isoDow = Number(formatInTimeZone(start, NZ_TZ, "i")); // 1=Mon … 7=Sun
  if (isoDow > 5) return false;
  const startMinutes =
    Number(formatInTimeZone(start, NZ_TZ, "H")) * 60 +
    Number(formatInTimeZone(start, NZ_TZ, "m"));
  const endMinutes = startMinutes + durationHours * 60;
  return (
    startMinutes >= WEEKDAY_DAYTIME_DEAL.windowStartHour * 60 &&
    endMinutes <= WEEKDAY_DAYTIME_DEAL.windowEndHour * 60
  );
}

/**
 * Price in cents (ex-GST) for the flat tier. Pass the booking START time so
 * the weekday-daytime 2-hour deal ($60+GST, Mon–Fri inside 10:00–16:00 NZ)
 * can be applied; without a start time the standard rate is charged.
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
  start?: Date | string | number | null,
): number {
  if (durationHours <= 1) return tier.peak_1h_price_cents;
  if (durationHours === 2) {
    if (start != null && isWeekdayDaytime(start, 2)) {
      return WEEKDAY_DAYTIME_DEAL.twoHourPriceCents;
    }
    return tier.peak_2h_price_cents;
  }
  // 3+ hours not bookable online; if ever called with one (e.g. admin quick
  // book), fall back to 2h + (extra hours * 1h). Admin can override on the
  // booking record after.
  return (
    tier.peak_2h_price_cents + (durationHours - 2) * tier.peak_1h_price_cents
  );
}

/** NZ GST. All stored prices are ex-GST. */
export const GST_RATE = 0.15;

/** GST-inclusive amount in cents from an ex-GST amount in cents. */
export function gstInclusiveCents(exGstCents: number): number {
  return Math.round(exGstCents * (1 + GST_RATE));
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

/** "$50.00+GST" from ex-GST cents. */
export function formatNZDPlusGst(cents: number): string {
  return `${nzd.format(cents / 100)}+GST`;
}

/**
 * "$80.00 + GST ($92.00)" from ex-GST cents — the ex-GST figure with the
 * GST-inclusive payable amount alongside. Use this anywhere a single
 * "total to pay" is shown (booking summary, emails, admin, receipts).
 */
export function formatNZDPlusGstIncl(cents: number): string {
  return `${nzd.format(cents / 100)} + GST (${nzd.format(gstInclusiveCents(cents) / 100)})`;
}

/** Split currency for the mono pricing display (symbol/amount weighted apart). */
export function priceParts(cents: number): { symbol: string; amount: string } {
  return { symbol: "$", amount: (cents / 100).toFixed(2) };
}
