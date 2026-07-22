import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyCustomerButton } from "@/components/admin/VerifyCustomerButton";
import { StatusBadge } from "@/components/admin/badges";
import { formatNZ } from "@/lib/timezone";
import { formatNZDPlusGst } from "@/lib/pricing";
import { formatNZPhone } from "@/lib/validation";
import { bankedHoursBalance, hourLedgerEntries } from "@/lib/banked-hours";
import { completedPlayHours } from "@/lib/rewards";
import { adjustBankedHours } from "@/app/admin/actions";
import type { Booking, Customer, HourLedgerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

type HistoryRow = Booking & { pricing_tier: { label: string } | null };

const LEDGER_REASON_LABEL: Record<HourLedgerEntry["reason"], string> = {
  pack_purchase: "Pack purchase",
  session_used: "Session used",
  session_refund: "Refund",
  adjustment: "Adjustment",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer: Customer | null = null;
  let history: HistoryRow[] = [];
  let bankedBalance = 0;
  let ledger: HourLedgerEntry[] = [];
  let completedHours = 0;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    customer = (data as Customer | null) ?? null;
    if (customer) {
      const [{ data: bks }, balance, entries, played] = await Promise.all([
        supabase
          .from("bookings")
          .select("*, pricing_tier:pricing_tiers(label)")
          .eq("customer_id", id)
          .order("start_time", { ascending: false }),
        bankedHoursBalance(supabase, id),
        hourLedgerEntries(supabase, id),
        completedPlayHours(supabase, id),
      ]);
      history = (bks as HistoryRow[]) ?? [];
      bankedBalance = balance;
      ledger = entries;
      completedHours = played;
    }
  } catch {
    customer = null;
  }

  if (!customer) notFound();
  const c = customer;

  return (
    <div className="p-5 md:p-10">
      <Link href="/admin/customers" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All customers
      </Link>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <h1 className="h2 text-text">{c.name}</h1>
        <VerifyCustomerButton customerId={c.id} verified={c.id_verified} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.6fr]">
        <section className="card h-fit p-6">
          <h2 className="eyebrow mb-5">Details</h2>
          <dl>
            {[
              ["Email", c.email],
              ["Phone", formatNZPhone(c.phone)],
              ["DOB", c.dob],
              ["Marketing", c.marketing_opt_in ? "Opted in" : "No"],
              ["Joined", formatNZ(c.created_at, "d MMM yyyy")],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0">
                <dt className="font-mono text-[11px] uppercase tracking-meta text-text-muted">{k}</dt>
                <dd className="text-right text-sm text-text">{v}</dd>
              </div>
            ))}
          </dl>
          {c.notes ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">Notes</p>
              <p className="mt-2 text-sm text-text">{c.notes}</p>
            </div>
          ) : null}
          <Link href="/admin/quick-book" className="btn btn-secondary mt-6 w-full h-10 font-mono text-xs uppercase tracking-meta">
            Create a booking
          </Link>
        </section>

        <section className="card h-fit p-6 lg:col-start-1">
          <h2 className="eyebrow mb-5">Banked hours &amp; play time</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mono text-2xl text-text">{bankedBalance}</p>
              <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">Banked hrs</p>
            </div>
            <div>
              <p className="mono text-2xl text-text">{completedHours}</p>
              <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">
                Played · {c.rewards_granted_hours} rewarded
              </p>
            </div>
          </div>

          {ledger.length > 0 ? (
            <ul className="mt-5 border-t border-border">
              {ledger.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">
                      {LEDGER_REASON_LABEL[e.reason]}
                    </p>
                    <p className="truncate text-xs text-text-dim">
                      {formatNZ(e.created_at, "d MMM yyyy")}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={`mono text-sm ${e.delta_hours > 0 ? "text-accent" : "text-text"}`}
                  >
                    {e.delta_hours > 0 ? "+" : ""}
                    {e.delta_hours}h
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-text-muted">No banked-hours activity.</p>
          )}

          <form action={adjustBankedHours} className="mt-5 border-t border-border pt-5">
            <input type="hidden" name="customerId" value={c.id} />
            <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">
              Adjust balance
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                name="delta"
                step={1}
                placeholder="±hrs"
                required
                className="input h-10 w-24"
              />
              <input
                type="text"
                name="note"
                placeholder="Reason (optional)"
                className="input h-10 flex-1"
              />
            </div>
            <button type="submit" className="btn btn-secondary mt-3 h-10 w-full font-mono text-xs uppercase tracking-meta">
              Apply adjustment
            </button>
          </form>
        </section>

        <section>
          <h2 className="eyebrow mb-5">Booking history</h2>
          {history.length === 0 ? (
            <p className="lead">No bookings yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="card card-hover flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="mono text-sm text-text">{b.friendly_id}</p>
                      <p className="mt-0.5 text-sm text-text-muted">
                        {formatNZ(b.start_time, "EEE d MMM yyyy")} · {formatNZ(b.start_time, "HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="mono text-sm text-text">{formatNZDPlusGst(b.total_price_cents)}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
