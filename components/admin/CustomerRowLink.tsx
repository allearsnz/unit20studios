"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Check } from "lucide-react";
import { CUSTOMER_GRID } from "./customerRowGrid";

/**
 * One customer, as a link — the same treatment the bookings list got, and for
 * the same two reasons: only the name used to be clickable, and the row sat in
 * a `min-w-[720px]` table that scrolled sideways on a phone.
 *
 * Below `md` it's a stacked block; from `md` up it's the original six columns.
 * CSS picks, not JavaScript, so the first paint is already right.
 */

type Props = {
  href: string;
  name: string;
  email: string;
  phone: string;
  verified: boolean;
  bookings: number;
  joined: string;
};

export function CustomerRowLink(props: Props) {
  return (
    <>
      <NarrowRow {...props} />
      <WideRow {...props} />
    </>
  );
}

function NarrowRow({ href, name, email, phone, verified, bookings, joined }: Props) {
  return (
    <Link
      href={href}
      className="group block border-b border-border py-3 text-sm transition-colors hover:bg-bg-elev focus-visible:bg-bg-elev focus-visible:outline-none md:hidden"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center text-text group-hover:text-accent">
          {name}
          <PendingHint />
        </span>
        <IdMark verified={verified} />
      </div>
      <p className="mt-1 break-all text-text-muted">{email}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 font-mono text-[11px] uppercase tracking-meta text-text-dim">
        <span>{phone}</span>
        <span>
          {bookings} {bookings === 1 ? "booking" : "bookings"} · joined {joined}
        </span>
      </div>
    </Link>
  );
}

function WideRow({ href, name, email, phone, verified, bookings, joined }: Props) {
  return (
    <Link
      href={href}
      className={`${CUSTOMER_GRID} group hidden border-b border-border py-3 text-sm transition-colors hover:bg-bg-elev focus-visible:bg-bg-elev focus-visible:outline-none md:grid`}
    >
      <span className="flex items-center truncate text-text group-hover:text-accent">
        {name}
        <PendingHint />
      </span>
      <span className="truncate text-text-muted">{email}</span>
      <span className="mono truncate text-text-muted">{phone}</span>
      <span>
        <IdMark verified={verified} />
      </span>
      <span className="mono text-right text-text">{bookings}</span>
      <span className="mono text-text-muted">{joined}</span>
    </Link>
  );
}

function IdMark({ verified }: { verified: boolean }) {
  return verified ? (
    <Check className="h-4 w-4 shrink-0 text-accent" aria-label="ID verified" />
  ) : (
    <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">No ID</span>
  );
}

function PendingHint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint ${pending ? "is-pending" : ""}`} />;
}
