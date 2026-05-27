import { createEvent, type EventAttributes } from "ics";
import { site } from "./site";

/**
 * Build an .ics calendar event for a booking. Times are emitted in UTC so the
 * file is unambiguous regardless of the recipient's timezone. Returns null on
 * failure (the caller treats the attachment as optional).
 */
export function buildBookingIcs(b: {
  friendly_id: string;
  start_time: string;
  end_time: string;
}): string | null {
  const start = new Date(b.start_time);
  const end = new Date(b.end_time);
  const durationMs = end.getTime() - start.getTime();

  const event: EventAttributes = {
    start: [
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      start.getUTCDate(),
      start.getUTCHours(),
      start.getUTCMinutes(),
    ],
    startInputType: "utc",
    startOutputType: "utc",
    duration: {
      hours: Math.floor(durationMs / 3_600_000),
      minutes: Math.round((durationMs % 3_600_000) / 60_000),
    },
    title: `Unit 20 — Studio session (${b.friendly_id})`,
    description: `Your Unit 20 studio booking.\nReference: ${b.friendly_id}\n${site.url}/studio/book/confirmation?id=${b.friendly_id}`,
    location: `${site.address.street}, ${site.address.locality}, ${site.address.region}`,
    geo: { lat: site.geo.lat, lon: site.geo.lng },
    url: `${site.url}/studio/book/confirmation?id=${b.friendly_id}`,
    organizer: { name: site.name, email: site.email },
    uid: `${b.friendly_id}@unit20.nz`,
    productId: "unit20/booking",
    status: "CONFIRMED",
  };

  const { error, value } = createEvent(event);
  if (error || !value) {
    console.error("[ics] failed to build event", error);
    return null;
  }
  return value;
}
