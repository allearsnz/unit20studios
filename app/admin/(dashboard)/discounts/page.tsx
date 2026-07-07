import { Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createDiscountCode,
  disableDiscountCode,
  enableDiscountCode,
  deleteDiscountCode,
} from "@/app/admin/actions";
import { formatNZ } from "@/lib/timezone";
import { DISCOUNT_PRESETS } from "@/lib/discounts";
import type { DiscountCode, DiscountStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = DiscountCode & { customer: { email: string; name: string } | null };

const STATUS_TONE: Record<DiscountStatus, string> = {
  active: "text-accent",
  disabled: "text-text-muted",
  expired: "text-text-dim",
};

function expiryLabel(row: DiscountCode): string {
  if (!row.expires_at) return "No expiry";
  const past = new Date(row.expires_at).getTime() <= Date.now();
  return `${past ? "Expired " : ""}${formatNZ(row.expires_at, "d MMM yyyy")}`;
}

function usesLabel(row: DiscountCode): string {
  return row.max_uses === null ? `${row.used_count} · ∞` : `${row.used_count} / ${row.max_uses}`;
}

export default async function DiscountsPage() {
  let codes: Row[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("discount_codes")
      .select("*, customer:customers(email,name)")
      .order("created_at", { ascending: false })
      .limit(500);
    codes = (data as Row[]) ?? [];
  } catch {
    configured = false;
  }

  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Discounts</h1>
      <p className="lead mt-2 max-w-lg">
        Percentage codes off the session rate. Email a single-use code straight from a
        booking, or create a reusable campaign code here. Codes validate and apply
        themselves when the customer books.
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        {/* ---- Create ---- */}
        <section className="card h-fit p-6">
          <h2 className="eyebrow mb-1">Create a code</h2>
          <p className="mb-5 text-sm text-text-muted">
            Leave the code blank to auto-name it. Leave max uses blank (or 0) for an
            unlimited, reusable campaign code.
          </p>
          <form action={createDiscountCode} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="d-percent" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                  % off
                </label>
                <input
                  id="d-percent"
                  name="percent"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={DISCOUNT_PRESETS[0]}
                  required
                  className="input mt-2"
                />
              </div>
              <div>
                <label htmlFor="d-max" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                  Max uses
                </label>
                <input
                  id="d-max"
                  name="max_uses"
                  type="number"
                  min={0}
                  defaultValue={1}
                  placeholder="blank = ∞"
                  className="input mt-2"
                />
              </div>
            </div>
            <div>
              <label htmlFor="d-code" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                Code (optional)
              </label>
              <input
                id="d-code"
                name="code"
                className="input mt-2 uppercase"
                placeholder="Auto-generated if blank"
              />
            </div>
            <div>
              <label htmlFor="d-expiry" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                Expires (optional)
              </label>
              <input
                id="d-expiry"
                name="expires_at"
                type="date"
                className="input mt-2 [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="d-note" className="font-mono text-meta uppercase tracking-meta text-text-muted">
                Note (optional)
              </label>
              <input id="d-note" name="note" className="input mt-2" placeholder="e.g. Winter campaign" />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Create code
            </button>
          </form>
        </section>

        {/* ---- List ---- */}
        <section>
          <h2 className="eyebrow mb-5">All codes</h2>
          {!configured ? (
            <p className="lead">Connect Supabase to manage discounts.</p>
          ) : codes.length === 0 ? (
            <p className="lead">No discount codes yet.</p>
          ) : (
            <ul className="space-y-2">
              {codes.map((row) => (
                <li key={row.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="mono text-base text-text">{row.code}</span>
                      <span className="font-mono text-sm text-accent">{row.percent}% off</span>
                      <span
                        className={`font-mono text-[11px] uppercase tracking-meta ${STATUS_TONE[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-meta text-text-muted">
                      Uses {usesLabel(row)} · {expiryLabel(row)}
                      {row.used_count > 0 ? " · redeemed" : ""}
                    </p>
                    {row.customer ? (
                      <p className="mt-0.5 text-sm text-text-muted">
                        Sent to {row.customer.name} · {row.customer.email}
                      </p>
                    ) : row.note ? (
                      <p className="mt-0.5 text-sm text-text-muted">{row.note}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {row.status === "disabled" ? (
                      <form action={enableDiscountCode.bind(null, row.id)}>
                        <button
                          type="submit"
                          className="h-9 rounded-sm border border-border px-3 font-mono text-[11px] uppercase tracking-meta text-text-muted hover:border-text hover:text-text"
                        >
                          Enable
                        </button>
                      </form>
                    ) : row.status === "active" ? (
                      <form action={disableDiscountCode.bind(null, row.id)}>
                        <button
                          type="submit"
                          className="h-9 rounded-sm border border-border px-3 font-mono text-[11px] uppercase tracking-meta text-text-muted hover:border-text hover:text-text"
                        >
                          Disable
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteDiscountCode.bind(null, row.id)}>
                      <button
                        type="submit"
                        aria-label="Delete discount code"
                        className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
