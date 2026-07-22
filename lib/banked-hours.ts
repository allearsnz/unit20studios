import type { SupabaseClient } from "@supabase/supabase-js";
import type { HourLedgerEntry, HourLedgerReason } from "./types";

/**
 * Current banked-hours balance for a customer = sum(delta_hours), floored at 0.
 * Service-role client (the hour_ledger table is deny-by-default under RLS).
 */
export async function bankedHoursBalance(
  admin: SupabaseClient,
  customerId: string,
): Promise<number> {
  const { data } = await admin
    .from("hour_ledger")
    .select("delta_hours")
    .eq("customer_id", customerId);
  const rows = (data as Pick<HourLedgerEntry, "delta_hours">[] | null) ?? [];
  const sum = rows.reduce((acc, r) => acc + r.delta_hours, 0);
  return Math.max(0, sum);
}

/** All ledger entries for a customer, newest first. Service-role client. */
export async function hourLedgerEntries(
  admin: SupabaseClient,
  customerId: string,
): Promise<HourLedgerEntry[]> {
  const { data } = await admin
    .from("hour_ledger")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  return (data as HourLedgerEntry[] | null) ?? [];
}

/**
 * Append a CREDIT (or an admin adjustment) to the ledger. Credits are plain
 * inserts — only debits need the atomic `debit_banked_hours` RPC to guard
 * against a negative balance. Service-role client.
 */
export async function creditBankedHours(
  admin: SupabaseClient,
  args: {
    customerId: string;
    hours: number; // positive credit; adjustments may be negative
    reason: HourLedgerReason;
    bookingId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  if (!args.hours) return; // delta_hours has a <> 0 check
  const { error } = await admin.from("hour_ledger").insert({
    customer_id: args.customerId,
    delta_hours: args.hours,
    reason: args.reason,
    booking_id: args.bookingId ?? null,
    note: args.note ?? null,
  });
  if (error) console.error("[banked-hours] credit insert failed", error);
}
