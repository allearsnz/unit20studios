"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * Submit button for the admin's server-action forms.
 *
 * Two jobs. It shows the action is in flight — without one, the page simply
 * sits there through the round trip and the natural response is to click again.
 * And where `confirm` is set it guards an irreversible write: deleting a
 * *recurring* blackout is one mis-tap that quietly reopens a window the studio
 * can't actually serve, and nobody finds out until a customer books it.
 *
 * Must be rendered inside the <form> — useFormStatus reads the nearest one.
 */
export function SubmitButton({
  children,
  busyLabel,
  confirm: confirmText,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  /** Replaces the label while in flight. Omit for icon-only buttons. */
  busyLabel?: string;
  /** Ask first. Irreversible actions only. */
  confirm?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      aria-busy={pending}
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
