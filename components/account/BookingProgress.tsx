import { Check, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingProgress as Progress, ProgressStep } from "@/lib/booking-progress";

/**
 * Where your booking is up to.
 *
 * Two layouts from one list, because a seven-step tracker laid out horizontally
 * on a 390px screen is either unreadable or a horizontal scrollbar, and neither
 * is a thing anyone wants on the page they land on straight after paying us:
 *
 *   - **phones** — a vertical timeline. Full labels, full detail lines, a rule
 *     running down the gutter. Nothing truncated, nothing sideways.
 *   - **sm and up** — a horizontal rail, connectors between the markers.
 *
 * The same markup renders both; no JavaScript and no media-query hook, so it's
 * server-rendered and correct on the first frame.
 */
export function BookingProgress({
  progress,
  className,
}: {
  progress: Progress;
  className?: string;
}) {
  const { steps, action, cancelled } = progress;

  return (
    <div className={className}>
      {/* Anything waiting on the customer leads, because it's the only part of
          this they can act on. */}
      {action ? (
        <p className="mb-6 border-l-2 border-amber-400 bg-amber-400/5 px-4 py-3 text-sm text-text">
          <span className="font-mono text-[11px] uppercase tracking-meta text-amber-400">
            Over to you
          </span>
          <span className="mt-1 block">{action}</span>
        </p>
      ) : null}

      {/* ---------------------------------------------- phones: vertical rail */}
      <ol className="sm:hidden">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector, drawn behind the marker and stopped on the last row. */}
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[7px] top-5 bottom-0 w-px",
                  step.state === "done" ? "bg-accent/40" : "bg-border",
                )}
              />
            ) : null}
            <Marker state={step.state} cancelled={cancelled} />
            <div className="min-w-0 flex-1 pt-px">
              <p className={cn("text-sm font-medium", labelTone(step.state))}>{step.label}</p>
              <p className="mt-1 text-sm text-text-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* ------------------------------------------- sm+: horizontal rail */}
      <ol className="hidden sm:flex sm:items-start">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={cn("relative flex-1", i < steps.length - 1 && "pr-2")}
          >
            <div className="flex items-center">
              <Marker state={step.state} cancelled={cancelled} />
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "ml-2 h-px flex-1",
                    step.state === "done" ? "bg-accent/40" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <p className={cn("mt-3 pr-3 text-sm font-medium", labelTone(step.state))}>
              {step.label}
            </p>
            {/* Detail only for the step in flight — seven paragraphs side by
                side is a wall, and the others are self-explanatory once ticked. */}
            {step.state === "current" ? (
              <p className="mt-1 pr-3 text-xs text-text-muted">{step.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function labelTone(state: ProgressStep["state"]) {
  return state === "done"
    ? "text-text"
    : state === "current"
      ? "text-accent"
      : state === "skipped"
        ? "text-text-dim line-through"
        : "text-text-muted";
}

function Marker({
  state,
  cancelled,
}: {
  state: ProgressStep["state"];
  cancelled: boolean;
}) {
  if (state === "done") {
    return (
      <span
        className={cn(
          "relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          cancelled ? "bg-text-dim/30 text-text-dim" : "bg-accent text-bg",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center">
        {/* A ring plus a pulse: the only moving thing on the page, and it marks
            the one step that is actually in flight. */}
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" aria-hidden />
        <Circle className="relative h-4 w-4 text-accent" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center text-text-dim">
      <Dot className="h-5 w-5" aria-hidden />
    </span>
  );
}
