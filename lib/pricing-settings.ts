import { z } from "zod";

/**
 * Everything about what a session costs, in one editable object.
 *
 * This used to be a handful of `const`s in `lib/pricing.ts` plus a row in
 * `pricing_tiers` that had to be kept in step by hand — a price change meant a
 * code edit AND a migration, and the two could silently disagree. Now the
 * object below is the single source of truth: it is stored as one JSON row in
 * `studio_settings` (key `pricing`), edited at `/admin/pricing`, and mirrored
 * back into `pricing_tiers` on save so the crew app's Studio tab keeps reading
 * the right numbers.
 *
 * The constants here are the FALLBACK, not the truth: if Supabase is
 * unreachable or the row hasn't been created yet, the site prices from
 * DEFAULT_PRICING_SETTINGS and keeps taking bookings. That's also why every
 * field is validated and merged rather than trusted — a half-written row must
 * never be able to make a session free.
 *
 * All money is in CENTS, EXCLUSIVE of GST. The UI appends "+GST".
 */

/** Slug of the one bookable tier row in `pricing_tiers`. */
export const TIER_SLUG = "small" as const;

/**
 * The online flow only ever schedules 1 or 2 hours — the slot grid, the option
 * ids and the availability API are all built on that. Longer sessions are
 * quoted by email, so this is a structural limit, not a price knob, and it
 * deliberately isn't editable in the admin panel.
 */
export const ONLINE_MAX_DURATION_HOURS = 2;

const cents = z.number().int().min(0).max(10_000_00);
const hour = z.number().int().min(0).max(24);

export const pricingSettingsSchema = z.object({
  room: z.object({
    /** Shown as the "Room" line on bookings, emails and the confirmation page. */
    label: z.string().trim().min(1).max(60),
    /** Hard cap on the group-size stepper and the booking API. */
    maxGroupSize: z.number().int().min(1).max(30),
  }),
  /** The standard, always-on rates. */
  rates: z.object({
    oneHourCents: cents,
    twoHourCents: cents,
  }),
  /**
   * A cheaper rate for 2-hour sessions that sit entirely inside a weekday
   * window. Turn `enabled` off and the deal stops existing everywhere at once:
   * the option card, the price rows, the availability flag, the server-side
   * price. Nothing else has to be edited.
   */
  weekdayDeal: z.object({
    enabled: z.boolean(),
    /** Window opens (NZ wall-clock hour). */
    windowStartHour: hour,
    /** The whole session must END by this hour. */
    windowEndHour: hour,
    twoHourPriceCents: cents,
    label: z.string().trim().min(1).max(80),
    /** Appended wherever the deal is named in short form, e.g. "(no sub)". */
    shortNote: z.string().trim().max(40),
  }),
  /**
   * The prepaid pack. The customer books the first `firstSessionHours` online;
   * `packHours` are banked to their account and drawn down from there.
   */
  pack: z.object({
    enabled: z.boolean(),
    packHours: z.number().int().min(1).max(100),
    firstSessionHours: z.number().int().min(1).max(ONLINE_MAX_DURATION_HOURS),
    totalCents: cents,
  }),
  /**
   * Flat surcharge for bigger groups, added on top of whatever the base rate
   * worked out to. Applies when groupSize > threshold.
   */
  groupSurcharge: z.object({
    threshold: z.number().int().min(0).max(30),
    oneHourCents: cents,
    twoHourCents: cents,
  }),
  /**
   * Per-card copy and an on/off switch for each option the customer picks
   * from. Switching one off removes it from the booking flow — the price
   * behind it stays configured, so it can come back with one click.
   */
  options: z.object({
    "1h": optionCopy("1 hour"),
    "2h": optionCopy("2 hours"),
    "2h-daytime": optionCopy("2 hours · weekday daytime"),
    pack10: optionCopy("Pack"),
  }),
});

function optionCopy(fallbackLabel: string) {
  return z.object({
    enabled: z.boolean(),
    label: z.string().trim().min(1).max(60).default(fallbackLabel),
    /** One-line description under the card title. */
    note: z.string().trim().max(160),
  });
}

export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export type OptionCopy = PricingSettings["options"][keyof PricingSettings["options"]];

/**
 * Flat $50+GST an hour, with the weekday-daytime deal and the 10-hour pack
 * running alongside it. Mirrors migration 0015 — change one, change the other,
 * because this is what the site falls back to when the row can't be read.
 */
export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  room: { label: "Up to 8 people", maxGroupSize: 8 },
  rates: {
    oneHourCents: 5000, // $50+GST / 1 hour
    twoHourCents: 10000, // $100+GST / 2 hours — flat $50/hr
  },
  weekdayDeal: {
    enabled: true,
    windowStartHour: 10,
    windowEndHour: 16,
    twoHourPriceCents: 6000, // $60+GST / 2 hours
    label: "Weekday daytime (Mon–Fri, 10am–4pm, no sub)",
    shortNote: "(no sub)",
  },
  pack: {
    enabled: true,
    packHours: 10,
    firstSessionHours: 2,
    totalCents: 25000, // $250+GST for 10 hours
  },
  groupSurcharge: {
    threshold: 4,
    oneHourCents: 2000, // +$20+GST on a 1-hour booking
    twoHourCents: 3000, // +$30+GST on a 2-hour booking
  },
  options: {
    "1h": {
      enabled: true,
      label: "1 hour",
      note: "A quick one — warm up, run your set.",
    },
    "2h": {
      enabled: true,
      label: "2 hours",
      note: "Room to properly dig in.",
    },
    "2h-daytime": {
      enabled: true,
      label: "2 hours · weekday daytime (no sub)",
      note: "Mon–Fri, sessions inside 10am–4pm. No sub.",
    },
    pack10: {
      enabled: true,
      label: "10-hour pack",
      note: "Prepay 10 hours at a lower rate. Book your first session now.",
    },
  },
};

/**
 * Take whatever came out of the database and produce a usable settings object.
 * Unknown or missing keys fall back to the defaults field by field, so adding
 * a setting later doesn't strand a row written before it existed — and a row
 * that fails validation outright is ignored rather than allowed to take
 * pricing down with it.
 */
export function parsePricingSettings(value: unknown): PricingSettings {
  const merged = mergeWithDefaults(value);
  const parsed = pricingSettingsSchema.safeParse(merged);
  if (!parsed.success) {
    console.error("[pricing] stored settings failed validation — using defaults", parsed.error.issues);
    return DEFAULT_PRICING_SETTINGS;
  }
  return parsed.data;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge a stored (possibly partial) object over the defaults. */
function mergeWithDefaults(value: unknown): unknown {
  if (!isRecord(value)) return DEFAULT_PRICING_SETTINGS;
  const merge = (base: unknown, over: unknown): unknown => {
    if (!isRecord(base) || !isRecord(over)) return over === undefined ? base : over;
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined) continue;
      out[k] = k in base ? merge(base[k], v) : v;
    }
    return out;
  };
  return merge(DEFAULT_PRICING_SETTINGS, value);
}

/**
 * Cross-field checks the admin form must pass. Deliberately NOT part of the
 * zod schema: `parsePricingSettings` has to stay forgiving so a stored row can
 * never take the site down, while a human typing a window that ends before it
 * starts should be told, not silently ignored. Returns null when it's fine.
 */
export function pricingSettingsProblem(s: PricingSettings): string | null {
  if (s.weekdayDeal.enabled && s.weekdayDeal.windowEndHour <= s.weekdayDeal.windowStartHour) {
    return "The weekday-daytime window has to end after it starts.";
  }
  if (s.weekdayDeal.enabled && s.weekdayDeal.windowEndHour - s.weekdayDeal.windowStartHour < 2) {
    return "The weekday-daytime window needs to be at least 2 hours wide, or no 2-hour session can fit inside it.";
  }
  if (s.pack.enabled && s.pack.firstSessionHours > s.pack.packHours) {
    return "The pack's first session can't be longer than the pack itself.";
  }
  if (s.groupSurcharge.threshold > s.room.maxGroupSize) {
    return `The surcharge threshold is above the room's maximum of ${s.room.maxGroupSize} — no group could ever pay it.`;
  }
  return null;
}

/** Cents per hour on the pack — derived, never stored, so it can't drift. */
export function packHourlyCents(s: PricingSettings): number {
  if (s.pack.packHours <= 0) return 0;
  return Math.round(s.pack.totalCents / s.pack.packHours);
}

/** Hours left banked after the pack's first session is scheduled. */
export function packBankedRemainder(s: PricingSettings): number {
  return Math.max(0, s.pack.packHours - s.pack.firstSessionHours);
}
