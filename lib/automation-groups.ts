import type { AutomationStep, StepState } from "./automation";

/**
 * Grouping for the automation checklist — deliberately in its own module.
 *
 * `lib/automation.ts` reaches `lib/xero.ts`, which imports `node:crypto`. The
 * panel that renders this is a client component, so importing `groupSteps` from
 * there dragged a 423KB `crypto-browserify` polyfill into the browser bundle for
 * the booking page. Nothing below has a runtime dependency on anything: the two
 * imports above are types, which are erased at compile time.
 */

/**
 * Twelve rows is the honest length of this checklist and none of them are
 * padding — but twelve rows open at once is also the reason the panel had to
 * live behind a tab. Grouping folds them into five lines that answer the
 * question from across the room ("is anything wrong?") and open on demand for
 * the one that is.
 *
 * The grouping is presentational only. Nothing here re-derives a state; a group
 * takes the worst state its steps are already in, so a collapsed group can
 * never look better than the rows inside it.
 */
export type AutomationGroup = {
  key: string;
  label: string;
  /** Worst state among the steps — a group is never greener than its contents. */
  state: StepState;
  /** Most recent timestamp among the done steps, for the collapsed line. */
  at: string | null;
  /** One line for the collapsed row: the first thing that isn't done, or a summary. */
  summary: string;
  steps: AutomationStep[];
};

/** Group order and membership. Anything unlisted lands in "Other" rather than
 *  vanishing — a new step in lib should show up wrong, not not at all. */
const GROUPS: { key: string; label: string; steps: string[] }[] = [
  { key: "id", label: "ID check", steps: ["id_link", "id_upload", "id_approved"] },
  { key: "booking", label: "Booking & invoice", steps: ["confirmed", "invoice"] },
  { key: "payment", label: "Payment", steps: ["paid"] },
  {
    key: "access",
    label: "Getting them in",
    steps: ["door_code_minted", "door_code_emailed", "access_email"],
  },
  {
    key: "comms",
    label: "Reminders & follow-up",
    steps: ["reminder", "verification_chase", "post_session"],
  },
];

/** Worst-first. A group shows the most alarming state any of its steps is in. */
const SEVERITY: StepState[] = ["failed", "unknown", "pending", "done", "na"];

export function groupSteps(steps: AutomationStep[]): AutomationGroup[] {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const claimed = new Set<string>();

  const groups: AutomationGroup[] = [];
  for (const g of GROUPS) {
    const members = g.steps
      .map((k) => {
        claimed.add(k);
        return byKey.get(k);
      })
      .filter((s): s is AutomationStep => Boolean(s));
    if (members.length > 0) groups.push(rollUp(g.key, g.label, members));
  }

  const orphans = steps.filter((s) => !claimed.has(s.key));
  if (orphans.length > 0) groups.push(rollUp("other", "Other", orphans));

  return groups;
}

function rollUp(key: string, label: string, members: AutomationStep[]): AutomationGroup {
  const state =
    SEVERITY.find((s) => members.some((m) => m.state === s)) ?? "na";

  // The newest thing that actually happened — what an admin scanning the
  // collapsed list wants next to the label.
  const at = members
    .filter((m) => m.state === "done" && m.at)
    .map((m) => m.at as string)
    .sort()
    .pop() ?? null;

  // Lead with the problem if there is one; otherwise say what's outstanding.
  const worst = members.find((m) => m.state === state);
  const done = members.filter((m) => m.state === "done").length;
  const applicable = members.filter((m) => m.state !== "na").length;
  const summary =
    state === "failed" || state === "unknown"
      ? (worst?.label ?? label)
      : state === "done"
        ? applicable > 1
          ? `All ${applicable} steps done`
          : (worst?.label ?? label)
        : state === "na"
          ? "Doesn't apply"
          : `${done}/${applicable} done — ${worst?.label.toLowerCase() ?? "waiting"}`;

  return { key, label, state, at, summary, steps: members };
}
