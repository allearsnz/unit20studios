/**
 * Friendly booking ids: U20-YYYY-NNNN.
 * Generation is atomic in Postgres (create_booking_slot); these are helpers for
 * formatting and parsing on the app side.
 */

export function formatFriendlyId(year: number, seq: number): string {
  return `U20-${year}-${String(seq).padStart(4, "0")}`;
}

export function parseFriendlyId(id: string): { year: number; seq: number } | null {
  const m = /^U20-(\d{4})-(\d{4,})$/.exec(id.trim());
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

export function isFriendlyId(id: string): boolean {
  return parseFriendlyId(id) !== null;
}
