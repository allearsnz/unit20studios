import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "./supabase/admin";
import {
  DEFAULT_PRICING_SETTINGS,
  TIER_SLUG,
  parsePricingSettings,
  type PricingSettings,
} from "./pricing-settings";

/**
 * Reading and writing the live pricing settings. SERVER ONLY — it goes through
 * the service-role client, because `studio_settings` is RLS-denied to everyone
 * (there is no customer-facing read path; prices reach the browser only as
 * props rendered by a server component).
 *
 * Everything here is failure-tolerant on purpose. Pricing is on the critical
 * path of the booking flow AND of the marketing pages, and a settings row that
 * can't be read must cost us the *edit*, never the sale: every read falls back
 * to DEFAULT_PRICING_SETTINGS, which is a complete, correct price list.
 */

const SETTINGS_KEY = "pricing";

export type PricingSettingsRead = {
  settings: PricingSettings;
  /** False when the stored row couldn't be read — the site is on defaults. */
  stored: boolean;
  /** Why it couldn't be read, for the admin panel to say out loud. */
  reason: "ok" | "no_row" | "no_table" | "not_configured" | "error";
  updatedAt: string | null;
};

/** Tag on the marketing-page cache entry; busted on every save. */
export const PRICING_CACHE_TAG = "studio-pricing";

async function fetchPricingSettings(): Promise<PricingSettingsRead> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return fallback("not_configured");
  }
  // A network failure here throws rather than returning an error — and this
  // read sits in front of the booking flow and the landing page, so it must
  // degrade to the defaults instead of taking them down with it.
  type Row = { value: unknown; updated_at: string | null };
  let data: Row | null = null;
  let error: { code?: string; message?: string } | null = null;
  try {
    const res = await supabase
      .from("studio_settings")
      .select("value,updated_at")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    data = (res.data as Row | null) ?? null;
    error = res.error;
  } catch (e) {
    console.error("[pricing] settings read threw", e);
    return fallback("error");
  }

  if (error) {
    // 42P01 = table missing (migration 0015 hasn't been applied yet). Distinct
    // from a real error because the admin panel tells you what to do about it.
    const missing = error.code === "42P01" || /studio_settings/.test(error.message ?? "");
    if (!missing) console.error("[pricing] settings read failed", error);
    return fallback(missing ? "no_table" : "error");
  }
  if (!data) return fallback("no_row");

  return {
    settings: parsePricingSettings(data.value),
    stored: true,
    reason: "ok",
    updatedAt: data.updated_at ?? null,
  };
}

function fallback(reason: PricingSettingsRead["reason"]): PricingSettingsRead {
  return { settings: DEFAULT_PRICING_SETTINGS, stored: false, reason, updatedAt: null };
}

/**
 * The live row, deduped per request (React `cache`) so a page needing prices in
 * three places still makes one query. Not cached between requests: this is the
 * read behind the booking API, quick-book and the admin panel, where the answer
 * has to be the current one. It's cheap — functions run in `hnd1`, next to the
 * database.
 */
export const readPricingSettings = cache(fetchPricingSettings);

/** The live settings, or the defaults. The everyday accessor. */
export async function getPricingSettings(): Promise<PricingSettings> {
  return (await readPricingSettings()).settings;
}

/**
 * The same settings for the *marketing* pages, held in the Data Cache and
 * busted by tag whenever they're saved.
 *
 * The landing page and the pricing page are otherwise fully static and served
 * from the Sydney CDN; making them query Supabase on every request would trade
 * an edge hit for a Tokyo round trip on the two pages most likely to be
 * someone's first impression. Tagged rather than time-based, so a price change
 * still shows up the moment it's saved; the five-minute window is only a
 * backstop for the day tag invalidation lets us down.
 */
export const getPublicPricingSettings = unstable_cache(
  async () => (await fetchPricingSettings()).settings,
  ["studio-pricing-settings"],
  { tags: [PRICING_CACHE_TAG], revalidate: 300 },
);

/**
 * Persist a new price list.
 *
 * Also mirrors the headline numbers into the `pricing_tiers` row, which is
 * read by the crew app's Studio tab and joined onto every booking for its
 * "Room" label. That mirror is why a price change no longer needs a migration:
 * the two stores can't drift, because one write updates both. A failure to
 * mirror is reported but doesn't undo the save — the site prices from
 * `studio_settings`, so it's already correct where it counts.
 */
export async function writePricingSettings(
  settings: PricingSettings,
  updatedBy: string | null,
): Promise<{ ok: boolean; error?: string; mirrorError?: string }> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return { ok: false, error: "Supabase isn't configured in this environment." };
  }

  let error: { code?: string; message?: string } | null = null;
  try {
    const res = await supabase.from("studio_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: settings,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "key" },
    );
    error = res.error;
  } catch (e) {
    console.error("[pricing] settings write threw", e);
    return { ok: false, error: "Couldn't reach the database — nothing was saved." };
  }
  if (error) {
    console.error("[pricing] settings write failed", error);
    return {
      ok: false,
      error:
        error.code === "42P01"
          ? "The studio_settings table doesn't exist yet — apply supabase/migrations/0015_studio_settings.sql."
          : (error.message ?? "Could not save."),
    };
  }

  try {
    const { error: mirrorError } = await supabase
      .from("pricing_tiers")
      .update({
        label: settings.room.label,
        max_people: settings.room.maxGroupSize,
        peak_1h_price_cents: settings.rates.oneHourCents,
        peak_2h_price_cents: settings.rates.twoHourCents,
      })
      .eq("slug", TIER_SLUG);
    if (mirrorError) {
      console.error("[pricing] pricing_tiers mirror failed", mirrorError);
      return { ok: true, mirrorError: mirrorError.message };
    }
  } catch (e) {
    console.error("[pricing] pricing_tiers mirror threw", e);
    return { ok: true, mirrorError: "the crew app's copy of the rates wasn't updated" };
  }

  return { ok: true };
}
