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
 * TWO LAYOUTS, because seven columns do not fit on a phone. The list used to be
 * a `min-w-[860px]` table in an overflow container, so checking a booking from
 * the van meant scrolling sideways to find the status. Below `md` each row is a
 * stacked block — reference and status on the top line, where they're wanted —
 * and from `md` up it's the original seven-column grid.
 *
 * Slots are named props rather than positional children precisely so the two
 * layouts can put them in different places.
 *
 * It stays a real `<Link>` rather than a div with an onClick, so middle-click,
 * cmd-click, "copy link address" and keyboard focus all still behave.
 */
type RowProps = {
  href: string;
  reference: string;
  customer: React.ReactNode;
  when: React.ReactNode;
  room: React.ReactNode;
  total: React.ReactNode;
  status: React.ReactNode;
  payment: React.ReactNode;
};

/**
 * Renders both variants and lets CSS pick one, rather than measuring the
 * viewport in JavaScript. A media-query hook would mean the first paint is a
 * guess and the row jumps once hydration corrects it — on the page whose whole
 * complaint was that clicking felt unresponsive.
 */
export function BookingRowLink(props: RowProps) {
  return (
    <>
      <NarrowRow {...props} />
      <WideRow {...props} />
    </>
  );
}

function NarrowRow({
  href,
  reference,
  customer,
  when,
  room,
  total,
  status,
  payment,
}: RowProps) {
  return (
    <Link
      href={href}
      className="group block border-b border-border py-3 text-sm transition-colors hover:bg-bg-elev focus-visible:bg-bg-elev focus-visible:outline-none md:hidden"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono flex items-center text-text group-hover:text-accent">
          {reference}
          <PendingHint />
        </span>
        {status}
      </div>
      <p className="mt-1.5 text-text">{customer}</p>
      <p className="mt-0.5 text-text-muted">{when}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-text-muted">{room}</span>
        <span className="flex shrink-0 items-baseline gap-3">
          <span className="mono text-text">{total}</span>
          {payment}
        </span>
      </div>
    </Link>
  );
}

/** The `md`-and-up row: the original seven-column grid. */
function WideRow({
  href,
  reference,
  customer,
  when,
  room,
  total,
  status,
  payment,
}: RowProps) {
  return (
    <Link
      href={href}
      className={`${ROW_GRID} group hidden border-b border-border py-3 text-sm transition-colors hover:bg-bg-elev focus-visible:bg-bg-elev focus-visible:outline-none md:grid`}
    >
      <span className="mono flex items-center text-text group-hover:text-accent">
        {reference}
        <PendingHint />
      </span>
      <span className="truncate text-text">{customer}</span>
      <span className="text-text-muted">{when}</span>
      <span className="truncate text-text-muted">{room}</span>
      <span className="mono text-right text-text">{total}</span>
      <span>{status}</span>
      <span>{payment}</span>
    </Link>
  );
}

function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint ${pending ? "is-pending" : ""}`} />;
}
