"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, CircleDashed, HelpCircle, Minus } from "lucide-react";
import { AutomationRetryButton } from "./AutomationRetryButton";
import { CopyButton } from "./CopyButton";
import { formatNZ } from "@/lib/timezone";
import { cn } from "@/lib/utils";
// `groupSteps` comes from its own module on purpose: `lib/automation` reaches
// `lib/xero`, which imports `node:crypto`, and a value import of it from this
// client component pulled a 423KB crypto polyfill into the browser bundle. The
// rest of these are type-only imports, which are erased.
import { groupSteps, type AutomationGroup } from "@/lib/automation-groups";
import type { AutomationStep, AutomationView, StepState } from "@/lib/automation";

/**
 * The whole automated life of one booking, folded into five lines.
 *
 * Every row is still a stored fact — a timestamp column or a row in
 * `studio_door_codes` — never an inference from booking status. See
 * lib/automation.ts for the derivation and for the two things that genuinely
 * cannot be observed.
 *
 * WHY IT COLLAPSES. Twelve honest rows is a wall, and a wall gets skimmed. The
 * collapsed line answers "is anything wrong?" from across the room; the group
 * opens for the one that is. A group is never greener than the steps inside it
 * (`groupSteps` takes the worst state), so nothing can hide in here.
 *
 * WHY IT'S A CLIENT COMPONENT. Opening a group used to mean a `?panel=` link and
 * a full server round trip to a database in Tokyo. Everything needed is already
 * in this payload; opening it should cost nothing.
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
  const groups = groupSteps(view.steps);
  const failed = view.steps.filter((s) => s.state === "failed").length;
  const code = view.doorCode;

  /**
   * Hover opens; click pins. Pinning matters because some groups contain a retry
   * button — without it the panel would close under the pointer on its way to
   * the thing it just revealed. Anything with a problem starts open: a failure
   * you have to go looking for is a failure you won't find.
   */
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.state === "failed").map((g) => g.key)),
  );

  const toggle = (key: string) =>
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      <p className="text-sm text-text-muted">
        {failed === 0
          ? "Everything that should have run so far, has."
          : `${failed} step${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} a look.`}
      </p>

      <ul className="mt-4">
        {groups.map((group) => (
          <Group
            key={group.key}
            bookingId={bookingId}
            group={group}
            open={pinned.has(group.key) || hovered === group.key}
            pinned={pinned.has(group.key)}
            onHover={() => setHovered(group.key)}
            onLeave={() => setHovered((h) => (h === group.key ? null : h))}
            onToggle={() => toggle(group.key)}
          />
        ))}
      </ul>

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

function Group({
  bookingId,
  group,
  open,
  pinned,
  onHover,
  onLeave,
  onToggle,
}: {
  bookingId: string;
  group: AutomationGroup;
  open: boolean;
  pinned: boolean;
  onHover: () => void;
  onLeave: () => void;
  onToggle: () => void;
}) {
  const s = STATE[group.state];
  const Icon = s.icon;

  return (
    <li
      className="border-t border-border first:border-t-0"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        onClick={onToggle}
        onFocus={onHover}
        onBlur={onLeave}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:text-text"
      >
        <Icon className={cn("h-4 w-4 shrink-0", s.iconClass)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm font-medium", s.text)}>{group.label}</span>
          <span className="mt-0.5 block truncate text-xs text-text-muted">{group.summary}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-meta text-text-dim">
          {group.at ? formatNZ(group.at, "d MMM") : s.label}
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-text-dim transition-transform duration-150",
            open && "rotate-90",
            pinned && "text-text-muted",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <ol className="mb-3 ml-7 border-l border-border pl-4">
          {group.steps.map((step) => (
            <Row key={step.key} bookingId={bookingId} step={step} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function Row({ bookingId, step }: { bookingId: string; step: AutomationStep }) {
  const s = STATE[step.state];
  const Icon = s.icon;

  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", s.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={cn("text-xs font-medium", s.text)}>{step.label}</p>
          <p className="font-mono text-[10px] uppercase tracking-meta text-text-dim">
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
