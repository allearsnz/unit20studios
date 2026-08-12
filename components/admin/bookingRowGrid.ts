/**
 * The column track shared by the bookings list header and its rows.
 *
 * IN ITS OWN MODULE, WITH NO `"use client"`, DELIBERATELY. It started life as an
 * export from `BookingRowLink.tsx`, which is a client component — so importing
 * it from the server-rendered page handed back a client *reference stub*, not
 * the string. Interpolated into a `className` template literal that stub
 * stringified to the text of an error function, and the header row silently lost
 * its grid and collapsed into one column. It looked like a Tailwind problem and
 * wasn't.
 *
 * A plain module has no boundary to cross: the server gets the string, the
 * client bundles the string, and Tailwind can see the literal to generate the
 * arbitrary-value class.
 */
export const ROW_GRID =
  "grid grid-cols-[8rem_minmax(8rem,1fr)_12.5rem_minmax(7rem,1fr)_6.5rem_7rem_6.5rem] items-center gap-x-4";
