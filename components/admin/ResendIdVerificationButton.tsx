"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { resendIdVerification } from "@/app/admin/actions";

const FAILURE_COPY: Record<string, string> = {
  already_verified: "Already verified.",
  customer_not_found: "Customer not found.",
  no_email: "No email on file.",
  email_not_configured: "Email isn't configured.",
};

/**
 * Sends the ID upload link, first time or again. Rotating the token is the
 * point — the old link dies, so this is also how you kill a link that's gone
 * astray.
 */
export function ResendIdVerificationButton({
  customerId,
  label = "Send ID link",
}: {
  customerId: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resendIdVerification(customerId);
            setResult(
              r.status === "sent"
                ? `Sent to ${r.email}`
                : (FAILURE_COPY[r.reason] ?? `Couldn't send — ${r.reason}`),
            );
          })
        }
        className="btn btn-secondary h-10 w-full px-4 font-mono text-xs uppercase tracking-meta"
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : label}
      </button>
      {result ? (
        <p aria-live="polite" className="mt-2 text-center text-xs text-text-muted">
          {result}
        </p>
      ) : null}
    </div>
  );
}
