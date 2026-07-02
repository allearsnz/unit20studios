import Link from "next/link";
import { CalendarOff, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentBadge, StatusBadge } from "@/components/admin/badges";
import { formatNZ, nzDateHourToUtc } from "@/lib/timezone";
import { formatNZDPlusGst } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { BookingWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  let bookings: BookingWithRelations[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    let q = supabase
      .from("bookings")
      .select("*, customer:customers(*), pricing_tier:pricing_tiers(*)");

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
    bookings = (data as BookingWithRelations[]) ?? [];
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
          <Link
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
          </Link>
        ))}
      </div>

      {!configured ? (
        <Notice>Connect Supabase (set the env vars) to load bookings.</Notice>
      ) : bookings.length === 0 ? (
        <Notice>No bookings in this view yet.</Notice>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-meta text-text-muted">
                <th className="py-3 pr-4 font-medium">Ref</th>
                <th className="py-3 pr-4 font-medium">Customer</th>
                <th className="py-3 pr-4 font-medium">When</th>
                <th className="py-3 pr-4 font-medium">Room</th>
                <th className="py-3 pr-4 text-right font-medium">Total</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="group border-b border-border transition-colors hover:bg-bg-elev">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/bookings/${b.id}`} className="mono text-text underline-offset-4 group-hover:text-accent">
                      {b.friendly_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-text">{b.customer?.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-text-muted">
                    <span className="mono">{formatNZ(b.start_time, "EEE d MMM")}</span>{" "}
                    <span className="mono text-text-dim">
                      {formatNZ(b.start_time, "HH:mm")}–{formatNZ(b.end_time, "HH:mm")}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-text-muted">
                    {b.pricing_tier?.label ?? "—"} · {b.group_size}
                  </td>
                  <td className="py-3 pr-4 text-right mono text-text">{formatNZDPlusGst(b.total_price_cents)}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="py-3">
                    <PaymentBadge status={b.payment_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
