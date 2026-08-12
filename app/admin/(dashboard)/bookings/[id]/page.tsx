import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AutomationPanel } from "@/components/admin/AutomationPanel";
import { BookingActions } from "@/components/admin/BookingActions";
import { CustomerCard } from "@/components/admin/CustomerCard";
import { DiscountOfferControl } from "@/components/admin/DiscountOfferControl";
import { PaymentControl } from "@/components/admin/PaymentControl";
import { InternalNote } from "@/components/admin/InternalNote";
import { StatusBadge } from "@/components/admin/badges";
import { type VerificationView, verificationView } from "@/lib/id-verification";
import { type AutomationView, automationView } from "@/lib/automation";
import { formatNZ } from "@/lib/timezone";
import { formatNZDPlusGst, formatNZDPlusGstIncl } from "@/lib/pricing";
import type { BookingWithRelations, IdVerification, StudioDoorCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let booking: BookingWithRelations | null = null;
  let idView: VerificationView = { state: "none", verification: null, front: null, back: null };
  let automation: AutomationView | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("bookings")
      .select("*, customer:customers(*), pricing_tier:pricing_tiers(*)")
      .eq("id", id)
      .maybeSingle();
    booking = (data as BookingWithRelations | null) ?? null;

    if (booking) {
      /**
       * Two round trips total, not five. The database is in Tokyo and this page
       * is rendered on the other side of an ocean, so every `await` on its own
       * line is ~200ms of nothing happening. These two rows are all the page
       * needs beyond the booking itself, and both the ID panel and the
       * automation checklist are built from them — the ID row used to be
       * fetched twice, once by each.
       */
      const [idRes, codeRes] = await Promise.all([
        supabase
          .from("id_verifications")
          .select("*")
          .eq("customer_id", booking.customer_id)
          .maybeSingle(),
        supabase
          .from("studio_door_codes")
          .select("*")
          .eq("booking_id", booking.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const idCheck = (idRes.data as IdVerification | null) ?? null;
      const doorCode = (codeRes.data as StudioDoorCode | null) ?? null;

      // Only this one can still hit the network, and only when there are
      // actually documents waiting to be looked at.
      if (booking.customer) {
        idView = await verificationView(supabase, booking.customer, idCheck);
      }
      automation = await automationView(supabase, booking, { idCheck, doorCode });
    }
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

          <Panel title="Rebook offer">
            <DiscountOfferControl bookingId={b.id} />
          </Panel>

          <Panel title="Session">
            <Dl
              rows={[
                ["When", `${formatNZ(b.start_time, "EEE d MMM yyyy")} · ${formatNZ(b.start_time, "HH:mm")}–${formatNZ(b.end_time, "HH:mm")}`],
                ["Duration", `${b.duration_hours}h`],
                ["Room", `${b.pricing_tier?.label ?? "—"} · ${b.group_size} people`],
                ...(b.discount_amount_cents > 0
                  ? ([["Discount", `−${formatNZDPlusGst(b.discount_amount_cents)}`]] as [string, string][])
                  : []),
                ["Total", formatNZDPlusGstIncl(b.total_price_cents)],
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
            <PaymentControl
              id={b.id}
              value={b.payment_status}
              customerEmail={c?.email ?? null}
              // Both read from the automation view so the warning here and the
              // checklist opposite are derived from the same clock read.
              sessionEnded={automation?.sessionEnded ?? false}
              cancelled={b.status === "cancelled"}
            />
          </Panel>

          <Panel title="Internal note">
            <InternalNote id={b.id} initial={b.internal_note ?? ""} />
          </Panel>
        </div>

        {/* right: who they are, then what has run for them.
            These were three tabs. Every tab click was a `?panel=` link against a
            force-dynamic page — a full server round trip to Tokyo to reveal data
            that was already a keystroke away. Customer and ID merged into one
            card, and automation sits underneath it, collapsed. */}
        <div className="space-y-8">
          <CustomerCard customer={c} view={idView} />

          <section className="card p-6">
            <h2 className="eyebrow mb-5">Automation</h2>
            {automation ? (
              <AutomationPanel bookingId={b.id} view={automation} />
            ) : (
              <p className="text-sm text-text-muted">
                Couldn&apos;t read the automation records for this booking.
              </p>
            )}
          </section>
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
