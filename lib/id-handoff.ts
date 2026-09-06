/**
 * Getting the ID upload token from the booking request to the confirmation
 * page, in the browser, without it ever touching a URL.
 *
 * `POST /api/bookings` hands the token back once, to the one browser that just
 * booked. It goes in `sessionStorage` — same tab, same origin, gone when the
 * tab is — and the confirmation page reads it there to put the upload form
 * straight in front of them. A query string would have put a working
 * credential into browser history, the server's access logs and every
 * `Referer` header the page leaks, which is the same reason the account signup
 * link doesn't carry an email address.
 *
 * There is no fallback here on purpose: no token simply means "we can't offer
 * the form in this tab", and the page falls back to emailing the link, which is
 * the path everybody had before.
 */

/**
 * How long someone gets to do it on the spot before the link is emailed to them
 * instead.
 *
 * THE EMAIL IS THE FALLBACK NOW, NOT THE FRONT DOOR. The upload form is on the
 * confirmation page the instant a booking lands, while they still have their
 * licence in their hand and the tab open — which is the one moment we know they
 * are present. A link that has to survive a spam filter, a full inbox and a
 * "later" is a link that gets lost, and a lost link is a slot that gets
 * released by the cleanup cron with nobody at fault (see the U20-2026-0010 note
 * in app/api/cron/cleanup).
 *
 * It lives here, not in `lib/id-verification.ts`, because both sides of the
 * clock need it and that module is server-only — it opens `node:crypto` and a
 * service-role Supabase client the moment it's imported.
 */
export const ON_PAGE_GRACE_MS = 5 * 60 * 1000;

const KEY = (friendlyId: string) => `u20:id-token:${friendlyId}`;

export function stashIdToken(friendlyId: string, token: string): void {
  try {
    window.sessionStorage.setItem(KEY(friendlyId), token);
  } catch {
    // Private mode, storage disabled, quota — the email fallback covers it.
  }
}

/** Read it without consuming it: a reload of the confirmation page must still
 *  show the form. */
export function readIdToken(friendlyId: string): string | null {
  try {
    return window.sessionStorage.getItem(KEY(friendlyId));
  } catch {
    return null;
  }
}

export function clearIdToken(friendlyId: string): void {
  try {
    window.sessionStorage.removeItem(KEY(friendlyId));
  } catch {
    // Nothing to do — it dies with the tab regardless.
  }
}
