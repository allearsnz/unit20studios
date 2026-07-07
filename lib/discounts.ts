import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscountCode } from "./types";

/** Single-use codes emailed from a booking expire this many days out. */
export const DISCOUNT_EXPIRY_DAYS = 60;

/** Percent presets surfaced in the admin UI. */
export const DISCOUNT_PRESETS = [10, 15, 20] as const;

/**
 * On-brand, memorable words for auto-generated codes. Paired with the percent
 * they carry (e.g. REMIX20) so the code reads as an offer at a glance.
 */
const CODE_WORDS = [
  "REMIX",
  "ENCORE",
  "BACKSPIN",
  "REWIND",
  "DROP",
  "GROOVE",
  "RELOAD",
  "AFTERHOURS",
  "SOUNDCHECK",
  "BOOTH",
  "VINYL",
  "CUE",
  "FADER",
  "PRESSPLAY",
  "HEADLINER",
  "WARMUP",
  "SESSION",
  "LOOP",
  "BASSLINE",
  "COMEBACK",
];

/** UPPERCASE, trimmed, alnum-only — the canonical stored/compared form. */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A single candidate, e.g. "REMIX20" or "GROOVE15X7F". */
function candidate(percent: number, withSuffix: boolean): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const suffix = withSuffix
    ? Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";
  return `${word}${percent}${suffix}`;
}

/**
 * Generate a memorable UPPERCASE code guaranteed unique in `discount_codes`.
 * Tries plain WORD+percent first, then adds a short random suffix on collision.
 * Service-role client required (reads the table).
 */
export async function generateUniqueCode(
  supabase: SupabaseClient,
  percent: number,
): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = candidate(percent, attempt >= 3);
    const { data } = await supabase
      .from("discount_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  // Extremely unlikely fallback — timestamp-salted, still unique in practice.
  return `${CODE_WORDS[0]}${percent}${Date.now().toString(36).toUpperCase()}`;
}

export type DiscountValidation = {
  valid: boolean;
  percent: number;
  reason?: string;
  /** The matched row (present whether valid or not) — server-side only. */
  row?: DiscountCode;
};

/**
 * Look up + validate a code. Valid only when status='active', not expired, and
 * under its usage cap (or max_uses is null = unlimited). Never trusts the
 * caller's percent — always returns the stored one. Service-role client.
 */
export async function validateDiscountCode(
  supabase: SupabaseClient,
  rawCode: string,
): Promise<DiscountValidation> {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, percent: 0, reason: "empty" };

  const { data } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  const row = data as DiscountCode | null;

  if (!row) return { valid: false, percent: 0, reason: "not_found" };
  if (row.status !== "active") {
    return { valid: false, percent: row.percent, reason: row.status, row };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { valid: false, percent: row.percent, reason: "expired", row };
  }
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { valid: false, percent: row.percent, reason: "used_up", row };
  }
  return { valid: true, percent: row.percent, row };
}

/** Discount (ex-GST cents) taken off a subtotal for a percent. */
export function discountAmountCents(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}
