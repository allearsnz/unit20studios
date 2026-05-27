"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPaymentStatus } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";

const OPTIONS: PaymentStatus[] = ["unpaid", "paid", "refunded", "comped"];

export function PaymentControl({ id, value }: { id: string; value: PaymentStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-sm border border-border p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={pending}
          aria-pressed={value === opt}
          onClick={() =>
            start(async () => {
              await setPaymentStatus(id, opt);
              router.refresh();
            })
          }
          className={cn(
            "rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-meta transition-colors",
            value === opt ? "bg-accent text-bg" : "text-text-muted hover:text-text",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
