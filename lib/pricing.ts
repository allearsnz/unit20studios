import { formatInTimeZone } from "date-fns-tz";
import { NZ_TZ } from "./timezone";
import type { PricingTier } from "./types";

/**
 * One bookable tier: groups up to 8, sessions of 1 or 2 hours online.
 * $50+GST for 1 hour, $80+GST for 2 hours — with a weekday-daytime deal
 * (see WEEKDAY_DAYTIME_DEAL) that makes qualifying 2-hour sessions $60+GST.
 * Groups of 5–8 add a flat surcharge (GROUP_SURCHARGE). Longer sessions go
 * through email (FLAT_LIMITS).
 * Prices are stored in cents, EXCLUSIVE of GST. UI appends "+GST".
 *
 * NOTE: the live booking API reads this tier from the `pricing_tiers` table,
 * so price changes here must ship with a matching supabase migration.
 */
export const FLAT_TIER: Omit<PricingTier, "id"> = {
  slug: "small",
  label: "Up to 8 people",
  max_people: 8,
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
 * Bulk pack: $25+GST/hr when you prepay 10 hours ($250+GST). Bookable online —
 * the customer schedules the FIRST 2 hours when they book; the remaining
 * 8 hours are arranged directly across future visits. The stored booking is
 * that first 2-hour session with the full pack price as its total.
 */
export const BULK_PACK = {
  hourlyCents: 2500,           // $25+GST / hr
  packHours: 10,               // prepaid block
  totalCents: 25000,           // $250+GST
  firstSessionHours: 2,        // scheduled online at booking time
} as const;

/**
 * Hard caps for the online booking flow.
 * Anything outside these gets routed to /contact with a prefilled subject.
 */
export const FLAT_LIMITS = {
  maxDurationHours: 2,
  maxGroupSize: 8,
} as const;

/**
 * Flat group surcharge for larger groups: bookings of MORE than
 * `threshold` people add a fixed amount (ex-GST) on top of the base rate —
 * +$20 for a 1-hour booking, +$30 for a 2-hour booking (the 10-hour pack's
 * first 2-hour session counts as a 2-hour booking). Applied in code, not
 * stored in `pricing_tiers`.
 */
export const GROUP_SURCHARGE = {
  threshold: 4,        // surcharge applies when groupSize > 4
  oneHourCents: 2000,  // +$20+GST on a 1h booking
  twoHourCents: 3000,  // +$30+GST on a 2h booking (incl. the pack's first 2h)
} as const;

/** Ex-GST group surcharge in cents for a booking; 0 when none applies. */
export function groupSurchargeCents(durationHours: number, groupSize: number): number {
  if (groupSize <= GROUP_SURCHARGE.threshold) return 0;
  return durationHours <= 1 ? GROUP_SURCHARGE.oneHourCents : GROUP_SURCHARGE.twoHourCents;
}

export const PRICING_TIERS: Omit<PricingTier, "id">[] = [FLAT_TIER];

/**
 * The four booking options the customer picks from (after the date, before
 * the time). Base prices mirror FLAT_TIER / WEEKDAY_DAYTIME_DEAL / BULK_PACK;
 * the group surcharge (GROUP_SURCHARGE) is added on top where it applies.
 */
export type BookingOptionId = "1h" | "2h" | "2h-daytime" | "pack10";

export type BookingOption = {
  id: BookingOptionId;
  /** Card title, e.g. "1 hour". */
  label: string;
  /** Hours scheduled now (the pack books its first 2 hours). */
  durationHours: 1 | 2;
  /** Base price in cents ex-GST, before any group surcharge. */
  baseCents: number;
  /** Only weekday starts that keep the session inside 10:00–16:00 qualify. */
  weekdayDaytimeOnly: boolean;
  /** True for the 10-hour pack. */
  isPack: boolean;
  /** One-line card description. */
  note: string;
};

export const BOOKING_OPTIONS: BookingOption[] = [
  {
    id: "1h",
    label: "1 hour",
    durationHours: 1,
    baseCents: FLAT_TIER.peak_1h_price_cents,
    weekdayDaytimeOnly: false,
    isPack: false,
    note: "A quick one — warm up, run your set.",
  },
  {
    id: "2h",
    label: "2 hours",
    durationHours: 2,
    baseCents: FLAT_TIER.peak_2h_price_cents,
    weekdayDaytimeOnly: false,
    isPack: false,
    note: "Room to properly dig in.",
  },
  {
    id: "2h-daytime",
    label: "2 hours · weekday daytime",
    durationHours: 2,
    baseCents: WEEKDAY_DAYTIME_DEAL.twoHourPriceCents,
    weekdayDaytimeOnly: true,
    isPack: false,
    note: "Mon–Fri, sessions inside 10am–4pm.",
  },
  {
    id: "pack10",
    label: "10-hour pack",
    durationHours: BULK_PACK.firstSessionHours,
    baseCents: BULK_PACK.totalCents,
    weekdayDaytimeOnly: false,
    isPack: true,
    note: "Prepay 10 hours at half rate. Book your first 2-hour session now.",
  },
];

export function bookingOption(id: BookingOptionId): BookingOption {
  const opt = BOOKING_OPTIONS.find((o) => o.id === id);
  if (!opt) throw new Error(`Unknown booking option: ${id}`);
  return opt;
}

/**
 * Full price for a booking option: base rate + group surcharge, in cents
 * ex-GST. Pass the START time so a plain "2h" booking still gets the
 * weekday-daytime rate when it happens to qualify (never charge more for
 * picking the generic option); omit it and the standard rate is used.
 * The pack's price is always the full pack ($250+GST) regardless of start.
 */
export function calcBookingPriceCents(args: {
  tier: Pick<PricingTier, "peak_1h_price_cents" | "peak_2h_price_cents">;
  optionId: BookingOptionId;
  start?: Date | string | number | null;
  groupSize: number;
}): { baseCents: number; surchargeCents: number; totalCents: number } {
  const { tier, optionId, start, groupSize } = args;
  const option = bookingOption(optionId);
  let baseCents: number;
  switch (optionId) {
    case "1h":
      baseCents = tier.peak_1h_price_cents;
      break;
    case "2h":
      baseCents =
        start != null && isWeekdayDaytime(start, 2)
          ? WEEKDAY_DAYTIME_DEAL.twoHourPriceCents
          : tier.peak_2h_price_cents;
      break;
    case "2h-daytime":
      baseCents = WEEKDAY_DAYTIME_DEAL.twoHourPriceCents;
      break;
    case "pack10":
      baseCents = BULK_PACK.totalCents;
      break;
  }
  const surchargeCents = groupSurchargeCents(option.durationHours, groupSize);
  return { baseCents, surchargeCents, totalCents: baseCents + surchargeCents };
}

/**
 * True when a session starting at `start` and running `durationHours` sits
 * entirely inside the weekday-daytime window: Mon–Fri, 10:00–16:00
 * Pacific/Auckland. For the 2-hour deal that means a weekday start between
 * 10:00 and 14:00 inclusive. (Sessions never cross midnight — the studio runs
 * 10:00–24:00 — and NZ DST switches at 2–3am, so plain wall-clock arithmetic
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
