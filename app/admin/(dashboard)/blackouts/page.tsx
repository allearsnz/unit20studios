import { Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBlackout, deleteBlackout } from "@/app/admin/actions";
import { formatNZ } from "@/lib/timezone";
import type { BlackoutPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

const PRESETS = ["Maintenance", "Event", "Personal use", "Holiday"];

export default async function BlackoutsPage() {
  let blackouts: BlackoutPeriod[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("blackout_periods")
      .select("*")
      .order("start_time", { ascending: false })
      .limit(200);
    blackouts = (data as BlackoutPeriod[]) ?? [];
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

      <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card h-fit p-6">
          <h2 className="eyebrow mb-5">Add a blackout</h2>
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
