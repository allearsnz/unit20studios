import { AlertTriangle, Check, CircleDashed, HelpCircle, Minus } from "lucide-react";
import { AutomationRetryButton } from "./AutomationRetryButton";
import { CopyButton } from "./CopyButton";
import { formatNZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { AutomationStep, AutomationView, StepState } from "@/lib/automation";

/**
 * The whole automated life of one booking, in the order it happens.
 *
 * Every row is a stored fact — a timestamp column or a row in
 * `studio_door_codes` — never an inference from booking status. Where nothing
 * was recorded the row says "no record", which is a worse-looking but far more
 * useful answer than a tick nobody should trust. See lib/automation.ts for the
 * derivation and for the two things that genuinely cannot be observed.
 */

const STATE: Record<
  StepState,
  { label: string; text: string; icon: typeof Check; iconClass: string }
> = {
  done: { label: "Done", text: "text-text", icon: Check, iconClass: "text-accent" },
  pending: { label: "Pending", text: "text-text-muted", icon: CircleDashed, iconClass: "text-text-dim" },
  failed: { label: "Failed", text: "text-text", icon: AlertTriangle, iconClass: "text-danger" },
  na: { label: "N/A", text: "text-text-dim", icon: Minus, iconClass: "text-text-dim" },
  unknown: { label: "No record", text: "text-text-muted", icon: HelpCircle, iconClass: "text-amber-400" },
};

export function AutomationPanel({
  bookingId,
  view,
}: {
  bookingId: string;
  view: AutomationView;
}) {
  const failed = view.steps.filter((s) => s.state === "failed").length;
  const code = view.doorCode;

  return (
    <div>
      <p className="text-sm text-text-muted">
        {failed === 0
          ? "Everything that should have run so far, has."
          : `${failed} step${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} a look.`}
      </p>

      <ol className="mt-5">
        {view.steps.map((step) => (
          <Row key={step.key} bookingId={bookingId} step={step} />
        ))}
      </ol>

      {/* The code itself, where an admin reading someone their way in over the
          phone can actually get at it. Only ever shown for a live code — an
          expired or superseded one would just get read out and not work. */}
      {code?.code && code.status === "active" ? (
        <div className="mt-5 flex items-center justify-between gap-4 border border-border bg-bg-elev px-4 py-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">
              Door code
            </p>
            <p className="mono mt-1 text-h3 tracking-[0.2em] text-text">{code.code}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-meta text-text-dim">
              {formatNZ(code.valid_from, "d MMM HH:mm")}–{formatNZ(code.valid_to, "HH:mm")}
            </p>
          </div>
          <CopyButton value={code.code} label="Copy" />
        </div>
      ) : null}

      <p className="mt-5 border-t border-border pt-4 text-xs text-text-dim">
        &ldquo;Sent&rdquo; means we handed the email to Resend — there is no bounce
        tracking, so it is not proof of delivery. And the studio lock stores its
        codes offline and never reports back, so whether the code was actually
        typed in is not something this page can know.
      </p>
    </div>
  );
}

function Row({ bookingId, step }: { bookingId: string; step: AutomationStep }) {
  const s = STATE[step.state];
  const Icon = s.icon;

  return (
    <li className="flex gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className={cn("text-sm font-medium", s.text)}>{step.label}</p>
          <p className="font-mono text-[11px] uppercase tracking-meta text-text-dim">
            {step.at ? formatNZ(step.at, "d MMM yyyy, HH:mm") : s.label}
          </p>
        </div>
        <p className="mt-1 text-xs text-text-muted">{step.detail}</p>
        {step.action ? (
          <AutomationRetryButton bookingId={bookingId} action={step.action} />
        ) : null}
      </div>
    </li>
  );
}
