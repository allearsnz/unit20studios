/**
 * The column track shared by the customers list header and its rows.
 *
 * Plain module, no `"use client"` — for the same reason as `bookingRowGrid.ts`.
 * A constant exported from a client component and imported by a server one
 * arrives as a reference stub, not a string, and interpolating that into a
 * `className` silently renders the text of an error function instead of any
 * classes. It fails as a layout bug, not an error, which is why it's worth a
 * file of its own rather than a comment.
 */
export const CUSTOMER_GRID =
  "grid grid-cols-[minmax(8rem,1.2fr)_minmax(10rem,1.6fr)_9rem_3rem_5.5rem_7rem] items-center gap-x-4";
