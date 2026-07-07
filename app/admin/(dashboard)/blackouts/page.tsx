import { Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createBlackout,
  deleteBlackout,
  createRecurringBlackout,
  deleteRecurringBlackout,
} from "@/app/admin/actions";
import { formatNZ } from "@/lib/timezone";
import type { BlackoutPeriod, RecurringBlackout } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRESETS = ["Maintenance", "Event", "Personal use", "Holiday"];

// Weekday chips in week order; value is the JS getDay() number stored in the rule.
const DOW: { n: number; label: string; weekday: boolean }[] = [
  { n: 1, label: "Mon", weekday: true },
  { n: 2, label: "Tue", weekday: true },
  { n: 3, label: "Wed", weekday: true },
  { n: 4, label: "Thu", weekday: true },
  { n: 5, label: "Fri", weekday: true },
  { n: 6, label: "Sat", weekday: false },
  { n: 0, label: "Sun", weekday: false },
];

function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function daysLabel(days: number[]): string {
  const set = new Set(days);
  const isWeekdays = [1, 2, 3, 4, 5].every((d) => set.has(d)) && !set.has(0) && !set.has(6);
  const isWeekends = set.has(0) && set.has(6) && set.size === 2;
  if (set.size === 7) return "Every day";
  if (isWeekdays) return "Weekdays (Mon–Fri)";
  if (isWeekends) return "Weekends";
  return DOW.filter((d) => set.has(d.n))
    .map((d) => d.label)
    .join(", ");
}

export default async function BlackoutsPage() {
  let blackouts: BlackoutPeriod[] = [];
  let recurring: RecurringBlackout[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    const [oneOff, recur] = await Promise.all([
      supabase
        .from("blackout_periods")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(200),
      supabase
        .from("recurring_blackouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    blackouts = (oneOff.data as BlackoutPeriod[]) ?? [];
    recurring = (recur.data as RecurringBlackout[]) ?? [];
  } catch {
    configured = false;
  }

  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Blackouts</h1>
      <p className="lead mt-2 max-w-lg">
        Block out the studio for maintenance, private use or events. Blackout
        windows hide their slots from the public booking calendar.
      </p>

      {/* ---- Recurring (permanent) rules ---- */}
      <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card h-fit p-6">
          <h2 className="eyebrow mb-1">Recurring blackout</h2>
          <p className="mb-5 text-sm text-text-muted">
            A permanent weekly rule — e.g. every weekday from open until 3pm.
          </p>
          <form action={createRecurringBlackout} className="space-y-5">
            <div>
              <span className="font-mono text-meta uppercase tracking-meta text-text-muted">
                Days
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {DOW.map((d) => (
                  <label
                    key={d.n}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-text has-[:checked]:border-text has-[:checked]:bg-text has-[:checked]:text-bg"
                  >
                    <input
                      type="checkbox"
                      name="day"
                      value={d.n}
                      defaultChecked={d.weekday}
                      className="sr-only"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-text-muted">
                Tap to toggle. Weekdays are pre-selected.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="r-start"
                  className="font-mono text-meta uppercase tracking-meta text-text-muted"
                >
                  From
                </label>
                <input
                  id="r-start"
                  name="start_time"
                  type="time"
                  defaultValue="10:00"
                  required
                  className="input mt-2 [color-scheme:dark]"
                />
              </div>
              <div>
                <label
                  htmlFor="r-end"
                  className="font-mono text-meta uppercase tracking-meta text-text-muted"
                >
                  Until
                </label>
                <input
                  id="r-end"
                  name="end_time"
                  type="time"
                  defaultValue="15:00"
                  required
                  className="input mt-2 [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="r-reason"
                className="font-mono text-meta uppercase tracking-meta text-text-muted"
              >
                Reason
              </label>
              <input
                id="r-reason"
                name="reason"
                list="blackout-reasons"
                className="input mt-2"
                placeholder="Personal use"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Add recurring blackout
            </button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow mb-5">Recurring rules</h2>
          {!configured ? (
            <p className="lead">Connect Supabase to manage blackouts.</p>
          ) : recurring.length === 0 ? (
            <p className="lead">No recurring blackouts.</p>
          ) : (
            <ul className="space-y-2">
              {recurring.map((r) => (
                <li key={r.id} className="card flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="mono text-sm text-text">
                      {daysLabel(r.days_of_week)} · {minutesToLabel(r.start_minute)} –{" "}
                      {minutesToLabel(r.end_minute)}
                    </p>
                    {r.reason ? (
                      <p className="mt-0.5 text-sm text-text-muted">{r.reason}</p>
                    ) : null}
                  </div>
                  <form action={deleteRecurringBlackout.bind(null, r.id)}>
                    <button
                      type="submit"
                      aria-label="Delete recurring blackout"
                      className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- One-off dated blackouts ---- */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card h-fit p-6">
          <h2 className="eyebrow mb-5">Add a one-off blackout</h2>
          <form action={createBlackout} className="space-y-5">
            <div>
              <label htmlFor="start" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                From
              </label>
              <input id="start" name="start" type="datetime-local" required className="input mt-2 [color-scheme:dark]" />
            </div>
            <div>
              <label htmlFor="end" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                To
              </label>
              <input id="end" name="end" type="datetime-local" required className="input mt-2 [color-scheme:dark]" />
            </div>
            <div>
              <label htmlFor="reason" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                Reason
              </label>
              <input id="reason" name="reason" list="blackout-reasons" className="input mt-2" placeholder="Maintenance" />
              <datalist id="blackout-reasons">
                {PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Add blackout
            </button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow mb-5">Scheduled</h2>
          {!configured ? (
            <p className="lead">Connect Supabase to manage blackouts.</p>
          ) : blackouts.length === 0 ? (
            <p className="lead">No blackouts scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {blackouts.map((b) => (
                <li key={b.id} className="card flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="mono text-sm text-text">
                      {formatNZ(b.start_time, "d MMM, HH:mm")} → {formatNZ(b.end_time, "d MMM, HH:mm")}
                    </p>
                    {b.reason ? <p className="mt-0.5 text-sm text-text-muted">{b.reason}</p> : null}
                  </div>
                  <form action={deleteBlackout.bind(null, b.id)}>
                    <button
                      type="submit"
                      aria-label="Delete blackout"
                      className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
