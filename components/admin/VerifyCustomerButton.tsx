"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { verifyCustomer } from "@/app/admin/actions";

/**
 * `verifyCustomer` revalidates both the customer page and the booking-page route
 * pattern, so the re-rendered page comes back with the action's result — there
 * is nothing left for a `router.refresh()` to fetch, and it used to fetch all of
 * it a second time.
 */
export function VerifyCustomerButton({
  customerId,
  verified,
}: {
  customerId: string;
  verified: boolean;
}) {
  const [pending, start] = useTransition();

  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-meta text-accent">
        <Check className="h-4 w-4" aria-hidden /> ID verified
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await verifyCustomer(customerId);
        })
      }
      className="btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta"
    >
      {pending ? "Verifying…" : "Mark ID-verified"}
    </button>
  );
}
