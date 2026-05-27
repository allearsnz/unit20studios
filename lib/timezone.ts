import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * All booking time maths runs in NZ local time so peak/off-peak and slot
 * boundaries stay correct across the spring-forward (last Sun of Sep) and
 * fall-back (first Sun of Apr) DST transitions. date-fns-tz resolves the
 * offset per-instant from the IANA database, so DST is handled automatically.
 */
export const NZ_TZ = "Pacific/Auckland";

/** Format an instant in NZ local time. */
export function formatNZ(
  value: Date | string | number,
  fmt: string,
): string {
  return formatInTimeZone(value, NZ_TZ, fmt);
}

/** Interpret NZ wall-clock parts as an absolute UTC instant. */
export function nzWallToUtc(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return fromZonedTime(`${year}-${mm}-${dd}T${hh}:${mi}:00`, NZ_TZ);
}

/** Build a UTC instant from an NZ wall-clock time on a given YYYY-MM-DD. */
export function nzDateHourToUtc(isoDate: string, hour: number): Date {
  return fromZonedTime(`${isoDate}T${String(hour).padStart(2, "0")}:00:00`, NZ_TZ);
}

/** A Date shifted into NZ local wall-clock (for reading parts). */
export function toNZ(value: Date | string | number): Date {
  return toZonedTime(value, NZ_TZ);
}

/**
 * Peak = NZ local time at/after 16:00, OR any time on Saturday/Sunday.
 * Everything else is off-peak. (This is the authoritative rule; the 09:00–16:00
 * window in the brief is the typical weekday off-peak band.)
 */
export function isPeakInstant(instant: Date | string | number): boolean {
  const isoDow = Number(formatInTimeZone(instant, NZ_TZ, "i")); // 1=Mon … 7=Sun
  if (isoDow === 6 || isoDow === 7) return true;
  return Number(formatInTimeZone(instant, NZ_TZ, "H")) >= 16;
}

/**
 * A booking is peak if any part of it touches peak time (spanning bookings are
 * charged peak for the whole session). Checking the start and the final minute
 * covers a session that crosses the 16:00 boundary.
 */
export function bookingIsPeak(start: Date, end: Date): boolean {
  const lastMinute = new Date(end.getTime() - 60_000);
  return isPeakInstant(start) || isPeakInstant(lastMinute);
}

/** "Sat 1 Jun, 7:00 PM" style label for an instant, in NZ time. */
export function formatBookingWhen(start: string | Date, end: string | Date): string {
  return `${formatNZ(start, "EEE d MMM, h:mmaaa")} – ${formatNZ(end, "h:mmaaa")}`;
}
