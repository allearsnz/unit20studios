import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyCustomerButton } from "@/components/admin/VerifyCustomerButton";
import { StatusBadge } from "@/components/admin/badges";
import { formatNZ } from "@/lib/timezone";
import { formatNZDPlusGst } from "@/lib/pricing";
import { formatNZPhone } from "@/lib/validation";
import type { Booking, Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

type HistoryRow = Booking & { pricing_tier: { label: string } | null };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer: Customer | null = null;
  let history: HistoryRow[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    customer = (data as Customer | null) ?? null;
    if (customer) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("*, pricing_tier:pricing_tiers(label)")
        .eq("customer_id", id)
        .order("start_time", { ascending: false });
      history = (bks as HistoryRow[]) ?? [];
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
