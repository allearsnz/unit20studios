"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { ROW_GRID } from "./bookingRowGrid";

/**
 * One row of the bookings list, as a single link.
 *
 * TWO THINGS THIS FIXES, both reported the same way ("I click a booking and
 * nothing happens, then I'm just on the booking page"):
 *
 *  1. Only the reference number used to be clickable — a ~60px target in a
 *     760px-wide row. Clicking the customer's name, the date, or the price did
 *     nothing at all. The whole row is the link now.
 *  2. The destination is `force-dynamic`, so there is nothing to prefetch and
 *     the pending phase is never skipped. `useLinkStatus` puts a dot next to the
 *     row you clicked for the moment before the route-level skeleton takes over.
 *     It is deliberately delayed (see `.link-hint` in globals.css) so a fast
 *     navigation doesn't flash anything at anyone.
 *
 * It stays a real `<Link>` rather than a div with an onClick, so middle-click,
 * cmd-click, "copy link address" and keyboard focus all still behave.
 */

export function BookingRowLink({
  href,
  reference,
  children,
}: {
  href: string;
  /** The friendly ref, rendered here so the pending dot can sit beside it. */
  reference: string;
  /** The remaining cells, server-rendered. */
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${ROW_GRID} group border-b border-border py-3 text-sm transition-colors hover:bg-bg-elev focus-visible:bg-bg-elev focus-visible:outline-none`}
    >
      <span className="mono flex items-center text-text group-hover:text-accent">
        {reference}
        <PendingHint />
      </span>
      {children}
    </Link>
  );
}

function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint ${pending ? "is-pending" : ""}`} />;
}
