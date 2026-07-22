import { createElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateUniqueCode } from "./discounts";
import { sendEmail, notifyAdmin } from "./email";
import { formatNZ } from "./timezone";
import { site } from "./site";
import RewardEarned from "@/emails/RewardEarned";
import type { Customer } from "./types";

/** Play-time reward mechanics. */
export const MILESTONE_HOURS = 10; // a reward every 10 completed hours
export const REWARD_PERCENT = 50; // 50% off
export const REWARD_EXPIRY_DAYS = 90;

/**
 * Understated achievement tiers keyed off completed play hours. Names are quiet
 * and literal on purpose — no badges, no confetti. The dashboard shows the
 * highest tier a customer has reached.
 */
export const ACHIEVEMENT_TIERS = [
  { hours: 10, label: "First Ten" },
  { hours: 20, label: "Regular" },
  { hours: 50, label: "Resident" },
  { hours: 100, label: "Headliner" },
] as const;

/** The highest tier reached at `hours` completed play, or null under 10h. */
export function currentTier(hours: number): (typeof ACHIEVEMENT_TIERS)[number] | null {
  let tier: (typeof ACHIEVEMENT_TIERS)[number] | null = null;
  for (const t of ACHIEVEMENT_TIERS) {
    if (hours >= t.hours) tier = t;
  }
  return tier;
}

/** Total completed play hours for a customer (status='completed' only). */
export async function completedPlayHours(
  admin: SupabaseClient,
  customerId: string,
): Promise<number> {
  const { data } = await admin
    .from("bookings")
    .select("duration_hours")
    .eq("customer_id", customerId)
    .eq("status", "completed");
  const rows = (data as { duration_hours: number }[] | null) ?? [];
  return rows.reduce((acc, r) => acc + (r.duration_hours ?? 0), 0);
}

/**
 * Mint milestone rewards for a customer, idempotently. Called when a booking
 * flips to `completed` (post-session cron + admin completion action).
 *
 * For every newly-crossed 10-hour multiple it creates one 50%-off, single-use,
 * `standard_only` code (valid on standard rates, refused on the 10-hour pack)
 * and emails it. Idempotency is a compare-and-swap on
 * `customers.rewards_granted_hours` (the highest multiple already rewarded), so
 * cron re-runs and concurrent callers never double-mint. Never throws — a
 * failure here must not break the caller.
 */
export async function grantMilestoneRewards(
  admin: SupabaseClient,
  customerId: string,
): Promise<void> {
  try {
    const { data } = await admin
      .from("customers")
      .select("id,email,name,rewards_granted_hours")
      .eq("id", customerId)
      .maybeSingle();
    const customer = data as Pick<
      Customer,
      "id" | "email" | "name" | "rewards_granted_hours"
    > | null;
    if (!customer) return;
    // Skip synthetic walk-in placeholders (quickBook) — no real inbox.
    if (customer.email.endsWith("@unit20.local")) return;

    const prev = customer.rewards_granted_hours ?? 0;
    const hours = await completedPlayHours(admin, customerId);
    const target = Math.floor(hours / MILESTONE_HOURS) * MILESTONE_HOURS;
    if (target <= prev) return;

    // Claim the new high-water mark. If another runner already moved it, bail —
    // it (not us) is responsible for minting the codes up to `target`.
    const { data: claimed } = await admin
      .from("customers")
      .update({ rewards_granted_hours: target })
      .eq("id", customerId)
      .eq("rewards_granted_hours", prev)
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    const firstName = (customer.name || "there").split(/\s+/)[0] || "there";

    for (let m = prev + MILESTONE_HOURS; m <= target; m += MILESTONE_HOURS) {
      const code = await generateUniqueCode(admin, REWARD_PERCENT);
      const expiresAt = new Date(Date.now() + REWARD_EXPIRY_DAYS * 24 * 3600 * 1000);
      const { error } = await admin.from("discount_codes").insert({
        code,
        percent: REWARD_PERCENT,
        status: "active",
        max_uses: 1,
        used_count: 0,
        standard_only: true,
        expires_at: expiresAt.toISOString(),
        customer_id: customerId,
        note: `Reward — ${m}h play-time milestone`,
      });
      if (error) {
        console.error("[rewards] code insert failed", error);
        continue;
      }

      // Email is best-effort — the code exists and is usable regardless.
      await sendEmail({
        to: customer.email,
        subject: `${REWARD_PERCENT}% off — ${m} hours in the booth`,
        react: createElement(RewardEarned, {
          firstName,
          hours: m,
          code,
          expiryLabel: formatNZ(expiresAt.toISOString(), "EEE d MMM yyyy"),
          bookUrl: `${site.url}/studio/book?code=${encodeURIComponent(code)}`,
        }),
      });
      await notifyAdmin(
        `Reward minted — ${m}h milestone`,
        `${customer.name} (${customer.email})\nCode ${code} · ${REWARD_PERCENT}% off · standard rates only`,
      );
    }
  } catch (e) {
    console.error("[rewards] grantMilestoneRewards failed", e);
  }
}
