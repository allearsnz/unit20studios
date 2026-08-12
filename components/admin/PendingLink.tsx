"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/**
 * A link that admits it has been clicked.
 *
 * Every list view in the admin is `force-dynamic`, so switching tabs is a real
 * server round trip to a database in Tokyo and the pending phase is never
 * skipped by prefetching. Route-level `loading.tsx` covers the body of the page;
 * this covers the control you actually clicked, which is where the eye is.
 *
 * The dot is delayed and opacity-animated (`.link-hint`, globals.css) so a fast
 * navigation shows nothing at all.
 */
export function PendingLink({
  href,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
      <Hint />
    </Link>
  );
}

function Hint() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-hint ${pending ? "is-pending" : ""}`} />;
}
