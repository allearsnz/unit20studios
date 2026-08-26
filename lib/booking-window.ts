/**
 * How much notice a customer-made booking needs.
 *
 * A session isn't a self-serve door: the room has to be turned around, the
 * decks powered up and the monitors checked before someone arrives. Someone
 * booking a 1pm session at 12:30 doesn't get a set-up room, they get whoever's
 * nearest scrambling. So a cold day takes `MIN_NOTICE_HOURS` of warning.
 *
 * **But the cost being protected is opening the room, and you only pay it
 * once.** If the day already has a session on it, the room is being set up for
 * that one regardless — so every start from that session onwards is open at
 * `WARM_DAY_NOTICE_MINUTES` instead. A 2pm booking means someone can take 5pm
 * at half past four. That's the same reasoning as the 4 hours, not an exception
 * to it.
 *
 * Note the waiver only ever *does* anything within `MIN_NOTICE_HOURS` of now —
 * outside that window everything is bookable anyway — so in practice it fires
 * when the room is already open or is opening within the next few hours.
 *
 * This gates the two customer paths only: `/api/bookings/availability` greys
 * the slots out and `POST /api/bookings` refuses them. **Admin quick-book
 * (`app/admin/actions.ts`) deliberately doesn't check any of it** — saying yes
 * to a walk-in in twenty minutes is Will choosing to be ready, and the rule
 * exists to protect exactly that choice.
 *
 * It's a floor on *lead time*, not on the calendar: a same-day booking made
 * this morning for tonight is completely fine.
 */
export const MIN_NOTICE_HOURS = 4;

export const MIN_NOTICE_MS = MIN_NOTICE_HOURS * 3600 * 1000;

/** Notice still needed once the room is already open that day. Not zero: a
 *  booking has to reach a human, and a start five minutes out isn't a booking,
 *  it's a surprise. */
export const WARM_DAY_NOTICE_MINUTES = 30;

export const WARM_DAY_NOTICE_MS = WARM_DAY_NOTICE_MINUTES * 60 * 1000;

/**
 * Which of the day's sessions mean "someone is opening the room".
 *
 * Deliberately *not* `pending_verification`: that booking holds its slot but it
 * may never confirm, and a booking that evaporates can't have set the room up.
 * Both halves of that are the cautious answer. `completed` counts because the
 * post-session cron flips this morning's session to it — the room was opened,
 * and that fact doesn't expire two hours later.
 */
export const ROOM_OPENING_STATUSES = ["confirmed", "completed"] as const;

export type DaySession = { start_time: string; status?: string | null };

/**
 * The instant the studio is already open on this day, or null if nobody's in.
 * The earliest opening session's start — the room stays set up from there.
 *
 * Pass only sessions that **start** inside that NZ day. A 23:00–01:00 session
 * overlaps the following day without opening it: it ended at 1am, and nobody
 * is set up for a 2pm because of it. Both callers filter on `start_time`.
 */
export function dayOpensAt(sessions: DaySession[]): number | null {
  let earliest: number | null = null;
  for (const s of sessions) {
    if (s.status && !ROOM_OPENING_STATUSES.includes(s.status as (typeof ROOM_OPENING_STATUSES)[number])) {
      continue;
    }
    const t = new Date(s.start_time).getTime();
    if (Number.isNaN(t)) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest;
}

/**
 * Can a customer book this start right now?
 *
 * @param opensAt  `dayOpensAt()` for the start's own NZ day, or null.
 */
export function isBookableStart(
  start: Date | string | number,
  opensAt: number | null,
  now: Date | number = Date.now(),
): boolean {
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (startMs <= nowMs) return false;
  if (startMs >= nowMs + MIN_NOTICE_MS) return true;
  // Warm day: the room is open from `opensAt`, so anything at or after that
  // point only needs enough notice to reach someone.
  return (
    opensAt !== null && startMs >= opensAt && startMs >= nowMs + WARM_DAY_NOTICE_MS
  );
}

/** Why this start was refused, in the customer's words — or null if it's fine. */
export function noticeRefusal(
  start: Date | string | number,
  opensAt: number | null,
  now: Date | number = Date.now(),
): string | null {
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime();
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (isBookableStart(startMs, opensAt, nowMs)) return null;
  if (startMs <= nowMs) return "That time has already passed — pick another.";
  // Inside the room-is-open window, so the 4-hour line would be a lie.
  if (opensAt !== null && startMs >= opensAt) {
    return (
      `That start is minutes away — even with the room already open that day we need ` +
      `${WARM_DAY_NOTICE_MINUTES} minutes' notice. Pick the next one.`
    );
  }
  return MIN_NOTICE_MESSAGE;
}

/** What a customer is told when they aim at a start on a cold day. */
export const MIN_NOTICE_MESSAGE =
  `Sessions need at least ${MIN_NOTICE_HOURS} hours' notice so the room is set up and ready before you arrive. ` +
  `Pick a later start — or email studio@unit20.nz if it has to be sooner.`;

/** The same rule as a one-line hint, for pickers and FAQ copy. */
export const MIN_NOTICE_NOTE = `Bookings need ${MIN_NOTICE_HOURS} hours' notice, so today's earliest starts have already gone.`;
