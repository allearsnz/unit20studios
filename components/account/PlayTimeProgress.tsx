import { MILESTONE_HOURS, REWARD_PERCENT, currentTier } from "@/lib/rewards";
import { cn } from "@/lib/utils";

/**
 * Understated play-time meter: a hairline progress track toward the next
 * 10-hour milestone, the current achievement tier, and a one-line explainer.
 * No confetti, no badges — numbers do the talking. Server-renderable.
 */
export function PlayTimeProgress({ completedHours }: { completedHours: number }) {
  const h = Math.max(0, completedHours);
  const intoMilestone = h % MILESTONE_HOURS; // 0..9(.x)
  const nextMilestone = Math.floor(h / MILESTONE_HOURS) * MILESTONE_HOURS + MILESTONE_HOURS;
  const pct = Math.min(100, Math.round((intoMilestone / MILESTONE_HOURS) * 100));
  const tier = currentTier(h);
  const remaining = Math.max(0, nextMilestone - h);
  const hoursLabel = Number.isInteger(h) ? `${h}` : h.toFixed(1);

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">Play time</p>
        {tier ? (
          <p className="font-mono text-meta uppercase tracking-meta text-accent">
            {tier.label} · {tier.hours} hrs
          </p>
        ) : null}
      </div>

      <p className="mono mt-4 text-3xl text-text">
        {hoursLabel}
        <span className="ml-2 font-sans text-meta uppercase tracking-meta text-text-muted">
          hrs played
        </span>
      </p>

      <div
        className="mt-5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MILESTONE_HOURS}
        aria-valuenow={Math.round(intoMilestone * 10) / 10}
        aria-label={`${hoursLabel} hours played. ${remaining} more until your next reward at ${nextMilestone} hours.`}
      >
        <div className="relative h-0.5 w-full bg-border">
          <div
            className={cn("absolute inset-y-0 left-0 bg-accent transition-[width] duration-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="font-mono text-meta uppercase tracking-meta text-text-muted">
            {remaining === 0 ? "Reward ready" : `${remaining} hrs to next reward`}
          </span>
          <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
            Next · {nextMilestone} hrs
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm text-text-muted">
        Every {MILESTONE_HOURS} hours in the booth earns a {REWARD_PERCENT}% reward code for a
        standard session.
      </p>
    </div>
  );
}
