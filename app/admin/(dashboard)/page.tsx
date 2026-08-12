import Link from "next/link";
import { CalendarOff, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingRowLink } from "@/components/admin/BookingRowLink";
// From a plain module, not from BookingRowLink — that file is a client
// component, and a constant imported across that boundary arrives as a
// reference stub rather than the string. See bookingRowGrid.ts.
import { ROW_GRID } from "@/components/admin/bookingRowGrid";
import { PendingLink } from "@/components/admin/PendingLink";
import { PaymentBadge, StatusBadge } from "@/components/admin/badges";
import { formatNZ, nzDateHourToUtc } from "@/lib/timezone";
import { formatNZDPlusGst } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Exactly what the list renders — and therefore exactly what the query asks for.
 * Naming the shape here rather than reusing `BookingWithRelations` is what stops
 * the select drifting back to `*`: add a column to the table below and this
 * won't compile until you fetch it.
 */
type BookingListRow = {
  id: string;
  friendly_id: string;
  start_time: string;
  end_time: string;
  group_size: number;
  total_price_cents: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  customer: { name: string } | null;
  pricing_tier: { label: string } | null;
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "upcoming" } = await searchParams;

  let bookings: BookingListRow[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    /**
     * Nine columns, not `*`.
     *
     * `select("*, customer:customers(*), pricing_tier:pricing_tiers(*)")` fetched
     * 33 booking columns joined to 13 customer columns and 10 tier columns, 200
     * rows deep — roughly 400KB dragged from Tokyo to render a table that shows
     * nine fields. It also put every customer's email, phone, DOB and notes into
     * the page payload for a list that displays none of them.
     *
     * Keep this in step with the row markup below.
     */
    let q = supabase
      .from("bookings")
      .select(
        "id,friendly_id,start_time,end_time,group_size,total_price_cents,status,payment_status," +
          "customer:customers(name),pricing_tier:pricing_tiers(label)",
      );

    const nowIso = new Date().toISOString();
    const todayNZ = formatNZ(new Date(), "yyyy-MM-dd");
    const dayStart = nzDateHourToUtc(todayNZ, 0);
    const dayStartIso = dayStart.toISOString();
    const dayEndIso = new Date(dayStart.getTime() + 24 * 3600 * 1000).toISOString();

    if (tab === "today") {
      q = q.gte("start_time", dayStartIso).lt("start_time", dayEndIso).order("start_time");
    } else if (tab === "past") {
      q = q.lt("start_time", nowIso).order("start_time", { ascending: false });
    } else if (tab === "all") {
      q = q.order("start_time", { ascending: false });
    } else {
      q = q.gte("start_time", nowIso).neq("status", "cancelled").order("start_time");
    }

    const { data } = await q.limit(200);
    bookings = (data as unknown as BookingListRow[]) ?? [];
  } catch {
    configured = false;
  }

  return (
    <div className="p-5 md:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="h2 text-text">Bookings</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/blackouts" className="btn btn-secondary h-10 px-4 font-mono text-xs uppercase tracking-meta">
            <CalendarOff className="h-4 w-4" aria-hidden /> New blackout
          </Link>
          <Link href="/admin/quick-book" className="btn btn-primary h-10 px-4 font-mono text-xs uppercase tracking-meta">
            <Zap className="h-4 w-4" aria-hidden /> Quick book
          </Link>
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-border" role="tablist">
        {TABS.map((t) => (
          <PendingLink
            key={t.key}
            href={`/admin?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-meta transition-colors",
              tab === t.key
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </PendingLink>
        ))}
      </div>

      {!configured ? (
        <Notice>Connect Supabase (set the env vars) to load bookings.</Notice>
      ) : bookings.length === 0 ? (
        <Notice>No bookings in this view yet.</Notice>
      ) : (
        <div className="mt-6">
          {/* Rows are links, not table rows — the whole row is the target and
              each one can show that it's been clicked. BookingRowLink renders a
              stacked block on phones and this seven-column grid from `md` up,
              so there's no sideways scrolling to find a status any more. */}
          <div
            className={`${ROW_GRID} hidden border-b border-border py-3 font-mono text-[11px] uppercase tracking-meta text-text-muted md:grid`}
          >
            <span>Ref</span>
            <span>Customer</span>
            <span>When</span>
            <span>Room</span>
            <span className="text-right">Total</span>
            <span>Status</span>
            <span>Payment</span>
          </div>

          {bookings.map((b) => (
            <BookingRowLink
              key={b.id}
              href={`/admin/bookings/${b.id}`}
              reference={b.friendly_id}
              customer={b.customer?.name ?? "—"}
              when={
                <>
                  <span className="mono">{formatNZ(b.start_time, "EEE d MMM")}</span>{" "}
                  <span className="mono text-text-dim">
                    {formatNZ(b.start_time, "HH:mm")}–{formatNZ(b.end_time, "HH:mm")}
                  </span>
                </>
              }
              room={`${b.pricing_tier?.label ?? "—"} · ${b.group_size}`}
              total={formatNZDPlusGst(b.total_price_cents)}
              status={<StatusBadge status={b.status} />}
              payment={<PaymentBadge status={b.payment_status} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 border border-dashed border-border bg-bg-elev/40 px-6 py-16 text-center">
      <p className="lead">{children}</p>
    </div>
  );
}
