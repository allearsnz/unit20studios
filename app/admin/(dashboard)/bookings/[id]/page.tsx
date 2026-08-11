import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { AutomationPanel } from "@/components/admin/AutomationPanel";
import { BookingActions } from "@/components/admin/BookingActions";
import { DiscountOfferControl } from "@/components/admin/DiscountOfferControl";
import { PaymentControl } from "@/components/admin/PaymentControl";
import { InternalNote } from "@/components/admin/InternalNote";
import { IdVerificationPanel } from "@/components/admin/IdVerificationPanel";
import { StatusBadge } from "@/components/admin/badges";
import { type VerificationView, verificationView } from "@/lib/id-verification";
import { type AutomationView, automationView } from "@/lib/automation";
import { formatNZ } from "@/lib/timezone";
import { formatNZDPlusGst, formatNZDPlusGstIncl } from "@/lib/pricing";
import { formatNZPhone } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { BookingWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Right-hand column tabs. Link-based with a `?panel=` param, matching the
 * dashboard's own tabs — this page is `force-dynamic` and every panel is
 * server-rendered from the database, so making it client state would mean
 * fetching the door code and ID signed URLs for panels nobody opened.
 */
const PANELS = [
  { key: "automation", label: "Automation" },
  { key: "customer", label: "Customer" },
  { key: "id", label: "ID" },
] as const;

type PanelKey = (typeof PANELS)[number]["key"];

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ panel?: string }>;
}) {
  const { id } = await params;
  const { panel: panelParam } = await searchParams;
  // Automation leads: "did they get their way in?" is the question this page is
  // opened to answer far more often than "what's their phone number".
  const panel: PanelKey =
    PANELS.find((p) => p.key === panelParam)?.key ?? "automation";

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
    if (booking?.customer) idView = await verificationView(supabase, booking.customer);
    if (booking) automation = await automationView(supabase, booking);
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

        {/* right: automation / customer / ID */}
        <div>
          <div className="flex gap-1 border-b border-border" role="tablist">
            {PANELS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/bookings/${b.id}?panel=${p.key}`}
                role="tab"
                aria-selected={panel === p.key}
                scroll={false}
                className={cn(
                  "-mb-px border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-meta transition-colors",
                  panel === p.key
                    ? "border-accent text-text"
                    : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <section className="card mt-6 p-6">
            {panel === "automation" ? (
              automation ? (
                <AutomationPanel bookingId={b.id} view={automation} />
              ) : (
                <p className="text-sm text-text-muted">
                  Couldn&apos;t read the automation records for this booking.
                </p>
              )
            ) : panel === "customer" ? (
              <>
                <Link
                  href={`/admin/customers/${c.id}`}
                  className="font-display text-h3 font-semibold text-text hover:text-accent"
                >
                  {c.name}
                </Link>
                <p className="mt-1 text-sm text-text-muted">{c.email}</p>
                <p className="mono text-sm text-text-muted">{formatNZPhone(c.phone)}</p>
                <div className="mt-5 border-t border-border pt-4">
                  <Dl
                    rows={[
                      ["DOB", c.dob],
                      ["Marketing", c.marketing_opt_in ? "Opted in" : "No"],
                    ]}
                  />
                </div>
              </>
            ) : (
              <IdVerificationPanel customerId={c.id} view={idView} verifiedAt={c.id_verified_at} />
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
