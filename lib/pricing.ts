import { formatInTimeZone } from "date-fns-tz";
import { NZ_TZ } from "./timezone";
import {
  DEFAULT_PRICING_SETTINGS,
  ONLINE_MAX_DURATION_HOURS,
  TIER_SLUG,
  packBankedRemainder,
  packHourlyCents,
  type PricingSettings,
} from "./pricing-settings";

/**
 * What a session costs. Every function here takes the live `PricingSettings`
 * (see `lib/pricing-settings.ts`) — nothing about price is hard-coded any
 * more, because it is all editable at `/admin/pricing`.
 *
 * Server code gets the settings from `getPricingSettings()`
 * (`lib/pricing-store.ts`); client components are handed them as a prop from
 * the server component that rendered them. Prices are in cents, EXCLUSIVE of
 * GST — the UI appends "+GST".
 */

export {
  DEFAULT_PRICING_SETTINGS,
  ONLINE_MAX_DURATION_HOURS,
  TIER_SLUG,
  packBankedRemainder,
  packHourlyCents,
};
export type { PricingSettings };

export type BookingOptionId =
  | "1h"
  | "2h"
  | "2h-daytime"
  | "pack10"
  | "banked-1h"
  | "banked-2h";

export type BookingOption = {
  id: BookingOptionId;
  /** Card title, e.g. "1 hour". */
  label: string;
  /** Hours scheduled now (the pack books its first session). */
  durationHours: number;
  /** Base price in cents ex-GST, before any group surcharge. */
  baseCents: number;
  /** Only weekday starts that keep the session inside the window qualify. */
  weekdayDaytimeOnly: boolean;
  /** True for the prepaid pack. */
  isPack: boolean;
  /**
   * True when the session is paid for with prepaid banked hours (base $0; the
   * customer's hour_ledger is debited). Only offered to signed-in accounts
   * with enough balance.
   */
  usesBankedHours?: boolean;
  /** One-line card description. */
  note: string;
};

/**
 * Every cash option, whether or not it's currently on offer. Price calculation
 * and admin views use this; the customer-facing list is `bookingOptions()`.
 */
export function allBookingOptions(s: PricingSettings): BookingOption[] {
  return [
    {
      id: "1h",
      label: s.options["1h"].label,
      durationHours: 1,
      baseCents: s.rates.oneHourCents,
      weekdayDaytimeOnly: false,
      isPack: false,
      note: s.options["1h"].note,
    },
    {
      id: "2h",
      label: s.options["2h"].label,
      durationHours: 2,
      baseCents: s.rates.twoHourCents,
      weekdayDaytimeOnly: false,
      isPack: false,
      note: s.options["2h"].note,
    },
    {
      id: "2h-daytime",
      label: s.options["2h-daytime"].label,
      durationHours: 2,
      baseCents: s.weekdayDeal.twoHourPriceCents,
      weekdayDaytimeOnly: true,
      isPack: false,
      note: s.options["2h-daytime"].note,
    },
    {
      id: "pack10",
      label: s.options.pack10.label,
      durationHours: s.pack.firstSessionHours,
      baseCents: s.pack.totalCents,
      weekdayDaytimeOnly: false,
      isPack: true,
      note: s.options.pack10.note,
    },
  ];
}

/**
 * True when an option is currently on offer. The deal card also needs the deal
 * itself switched on, and the pack card the pack — one switch, not two, is
 * what the admin panel presents, but both are honoured here so an old row
 * (deal off, deal card still on) can't put an unbuyable card on the page.
 */
export function isOptionOffered(s: PricingSettings, id: BookingOptionId): boolean {
  switch (id) {
    case "1h":
      return s.options["1h"].enabled;
    case "2h":
      return s.options["2h"].enabled;
    case "2h-daytime":
      return s.options["2h-daytime"].enabled && s.weekdayDeal.enabled;
    case "pack10":
      return s.options.pack10.enabled && s.pack.enabled;
    case "banked-1h":
    case "banked-2h":
      // Prepaid hours are the customer's already — never switched off by price
      // settings. The balance is what gates these.
      return true;
  }
}

/** The cash options a customer can actually pick right now. */
export function bookingOptions(s: PricingSettings): BookingOption[] {
  return allBookingOptions(s).filter((o) => isOptionOffered(s, o.id));
}

/**
 * Banked-hours options — only shown to signed-in customers whose ledger
 * balance covers the duration. Base price is $0 (the ledger is debited); the
 * group surcharge still applies in cash.
 */
export const BANKED_OPTIONS: BookingOption[] = [
  {
    id: "banked-1h",
    label: "1 hour · banked",
    durationHours: 1,
    baseCents: 0,
    weekdayDaytimeOnly: false,
    isPack: false,
    usesBankedHours: true,
    note: "Uses 1 of your prepaid hours.",
  },
  {
    id: "banked-2h",
    label: "2 hours · banked",
    durationHours: 2,
    baseCents: 0,
    weekdayDaytimeOnly: false,
    isPack: false,
    usesBankedHours: true,
    note: "Uses 2 of your prepaid hours.",
  },
];

export function bookingOption(s: PricingSettings, id: BookingOptionId): BookingOption {
  const opt = [...allBookingOptions(s), ...BANKED_OPTIONS].find((o) => o.id === id);
  if (!opt) throw new Error(`Unknown booking option: ${id}`);
  return opt;
}

/** Ex-GST group surcharge in cents for a booking; 0 when none applies. */
export function groupSurchargeCents(
  s: PricingSettings,
  durationHours: number,
  groupSize: number,
): number {
  if (groupSize <= s.groupSurcharge.threshold) return 0;
  return durationHours <= 1 ? s.groupSurcharge.oneHourCents : s.groupSurcharge.twoHourCents;
}

/**
 * Full price for a booking option: base rate + group surcharge, in cents
 * ex-GST. Pass the START time so a plain "2h" booking still gets the
 * weekday-daytime rate when it happens to qualify (never charge more for
 * picking the generic option); omit it and the standard rate is used.
 * The pack's price is always the full pack regardless of start.
 */
export function calcBookingPriceCents(args: {
  settings: PricingSettings;
  optionId: BookingOptionId;
  start?: Date | string | number | null;
  groupSize: number;
}): { baseCents: number; surchargeCents: number; totalCents: number } {
  const { settings: s, optionId, start, groupSize } = args;
  const option = bookingOption(s, optionId);
  let baseCents: number;
  switch (optionId) {
    case "1h":
      baseCents = s.rates.oneHourCents;
      break;
    case "2h":
      baseCents =
        start != null && weekdayDealApplies(s, start, 2)
          ? s.weekdayDeal.twoHourPriceCents
          : s.rates.twoHourCents;
      break;
    case "2h-daytime":
      baseCents = s.weekdayDeal.twoHourPriceCents;
      break;
    case "pack10":
      baseCents = s.pack.totalCents;
      break;
    case "banked-1h":
    case "banked-2h":
      // Paid with prepaid banked hours — the session itself is $0. Any group
      // surcharge is still charged in cash below.
      baseCents = 0;
      break;
  }
  const surchargeCents = groupSurchargeCents(s, option.durationHours, groupSize);
  return { baseCents, surchargeCents, totalCents: baseCents + surchargeCents };
}

/**
 * True when a session starting at `start` and running `durationHours` sits
 * entirely inside the weekday-daytime window (Mon–Fri, between the configured
 * hours, Pacific/Auckland) AND the deal is switched on. With the default 2-hour
 * deal and a 10:00–16:00 window that means a weekday start between 10:00 and
 * 14:00 inclusive. (Sessions never cross midnight — the studio runs 10:00–24:00
 * — and NZ DST switches at 2–3am, so plain wall-clock arithmetic is safe here.)
 */
export function weekdayDealApplies(
  s: PricingSettings,
  start: Date | string | number,
  durationHours = 2,
): boolean {
  if (!s.weekdayDeal.enabled) return false;
  // The deal is a 2-hour rate; a 1-hour session is already cheaper than it.
  if (durationHours !== 2) return false;
  const isoDow = Number(formatInTimeZone(start, NZ_TZ, "i")); // 1=Mon … 7=Sun
  if (isoDow > 5) return false;
  const startMinutes =
    Number(formatInTimeZone(start, NZ_TZ, "H")) * 60 +
    Number(formatInTimeZone(start, NZ_TZ, "m"));
  const endMinutes = startMinutes + durationHours * 60;
  return (
    startMinutes >= s.weekdayDeal.windowStartHour * 60 &&
    endMinutes <= s.weekdayDeal.windowEndHour * 60
  );
}

/**
 * Price in cents (ex-GST) for a session of `durationHours`. Pass the booking
 * START time so the weekday-daytime 2-hour deal can be applied; without a
 * start time the standard rate is charged. Used by admin quick-book, where the
 * duration is typed in rather than picked from an option card.
 */
export function calcPriceCents(
  s: PricingSettings,
  durationHours: number,
  start?: Date | string | number | null,
): number {
  if (durationHours <= 1) return s.rates.oneHourCents;
  if (durationHours === 2) {
    if (start != null && weekdayDealApplies(s, start, 2)) {
      return s.weekdayDeal.twoHourPriceCents;
    }
    return s.rates.twoHourCents;
  }
  // 3+ hours aren't bookable online. Quick-book can still ask for one: charge
  // 2h + (extra hours × the 1h rate). Admin can override on the booking after.
  return s.rates.twoHourCents + (durationHours - 2) * s.rates.oneHourCents;
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

/**
 * "10am" / "4pm" / "midnight" from a 24-hour clock hour. Used wherever the
 * weekday-daytime window is described in copy, so moving the window in the
 * admin panel moves every sentence that mentions it.
 */
export function formatHour(h: number): string {
  const hour = ((Math.round(h) % 24) + 24) % 24;
  if (hour === 0) return "midnight";
  if (hour === 12) return "midday";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/** Split currency for the mono pricing display (symbol/amount weighted apart). */
export function priceParts(cents: number): { symbol: string; amount: string } {
  return { symbol: "$", amount: (cents / 100).toFixed(2) };
}
