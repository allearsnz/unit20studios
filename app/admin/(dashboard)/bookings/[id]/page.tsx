import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingActions } from "@/components/admin/BookingActions";
import { PaymentControl } from "@/components/admin/PaymentControl";
import { InternalNote } from "@/components/admin/InternalNote";
import { VerifyCustomerButton } from "@/components/admin/VerifyCustomerButton";
import { StatusBadge } from "@/components/admin/badges";
import { formatNZ } from "@/lib/timezone";
import { formatNZD } from "@/lib/pricing";
import { formatNZPhone } from "@/lib/validation";
import type { BookingWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let booking: BookingWithRelations | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("bookings")
      .select("*, customer:customers(*), pricing_tier:pricing_tiers(*)")
      .eq("id", id)
      .maybeSingle();
    booking = (data as BookingWithRelations | null) ?? null;
  } catch {
    booking = null;
  }

  if (!booking) notFound();
  const b = booking;
  const c = b.customer;

  return (
    <div className="p-5 md:p-10">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-text-muted hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All bookings
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <h1 className="mono text-h2 text-text">{b.friendly_id}</h1>
        <StatusBadge status={b.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* left: actions + booking */}
        <div className="space-y-8">
          <Panel title="Actions">
            <BookingActions id={b.id} status={b.status} />
          </Panel>

          <Panel title="Session">
            <Dl
              rows={[
                ["When", `${formatNZ(b.start_time, "EEE d MMM yyyy")} · ${formatNZ(b.start_time, "HH:mm")}–${formatNZ(b.end_time, "HH:mm")}`],
                ["Duration", `${b.duration_hours}h · ${b.is_peak ? "Peak" : "Off-peak"}`],
                ["Room", `${b.pricing_tier?.label ?? "—"} · ${b.group_size} people`],
                ["Total", formatNZD(b.total_price_cents)],
                ["Source", b.source || "direct"],
                ["Booked", formatNZ(b.created_at, "d MMM yyyy, HH:mm")],
              ]}
            />
            {b.customer_note ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">Customer note</p>
                <p className="mt-2 text-sm text-text">{b.customer_note}</p>
              </div>
            ) : null}
          </Panel>

          <Panel title="Payment">
            <PaymentControl id={b.id} value={b.payment_status} />
          </Panel>

          <Panel title="Internal note">
            <InternalNote id={b.id} initial={b.internal_note ?? ""} />
          </Panel>
        </div>

        {/* right: customer */}
        <div className="space-y-8">
          <Panel title="Customer">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link href={`/admin/customers/${c.id}`} className="font-display text-h3 font-semibold text-text hover:text-accent">
                  {c.name}
                </Link>
                <p className="mt-1 text-sm text-text-muted">{c.email}</p>
                <p className="mono text-sm text-text-muted">{formatNZPhone(c.phone)}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <Dl
                rows={[
                  ["DOB", c.dob],
                  ["Marketing", c.marketing_opt_in ? "Opted in" : "No"],
                ]}
              />
              <div className="mt-4">
                <VerifyCustomerButton customerId={c.id} verified={c.id_verified} />
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="eyebrow mb-5">{title}</h2>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl>
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0">
          <dt className="font-mono text-[11px] uppercase tracking-meta text-text-muted">{k}</dt>
          <dd className="text-right text-sm text-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
