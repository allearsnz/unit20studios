"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { verifyCustomer } from "@/app/admin/actions";

export function VerifyCustomerButton({
  customerId,
  verified,
}: {
  customerId: string;
  verified: boolean;
}) {
  const router = useRouter();
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
          router.refresh();
        })
      }
      className="btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta"
    >
      {pending ? "Verifying…" : "Mark ID-verified"}
    </button>
  );
}
