import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bankedHoursBalance } from "@/lib/banked-hours";
import { completedPlayHours } from "@/lib/rewards";
import { AccountSignOut } from "@/components/account/AccountSignOut";
import { PlayTimeProgress } from "@/components/account/PlayTimeProgress";
import { BankedHoursCard } from "@/components/account/BankedHoursCard";
import { RewardsList } from "@/components/account/RewardsList";
import { BookingList, type AccountBooking } from "@/components/account/BookingList";
import type { DiscountCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const { user, customer } = await requireCustomer();

  // Signed in, but no bookings/customer record yet (or Supabase unconfigured).
  if (!customer) {
    return (
      <div className="container-page min-h-[70dvh] pb-24 pt-32 md:pt-40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="h1 text-text">Your account</h1>
          <AccountSignOut />
        </div>
        <p className="lead mt-4 max-w-prose">
          You&rsquo;re signed in as <span className="text-text">{user.email}</span>. Once you book
          your first session it&rsquo;ll show up here — along with your play time, banked hours and
          rewards.
        </p>
        <Link href="/studio/book" className="btn btn-primary mt-8">
          Book a session
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const [{ data: bookingRows }, balance, completedHours, { data: rewardRows }] = await Promise.all([
    admin
      .from("bookings")
      .select("*, pricing_tier:pricing_tiers(label)")
      .eq("customer_id", customer.id)
      .neq("status", "cancelled")
      .order("start_time", { ascending: false }),
    bankedHoursBalance(admin, customer.id),
    completedPlayHours(admin, customer.id),
    admin
      .from("discount_codes")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at", { ascending: false }),
  ]);

  const bookings = (bookingRows as AccountBooking[] | null) ?? [];
  const rewards = (rewardRows as DiscountCode[] | null) ?? [];
  const upcoming = bookings
    .filter((b) => b.end_time >= nowIso && b.status !== "completed")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = bookings.filter((b) => !(b.end_time >= nowIso && b.status !== "completed"));

  // Only surface the banked card if there's history worth showing.
  const { count: ledgerCount } = await admin
    .from("hour_ledger")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id);
  const showBanked = (ledgerCount ?? 0) > 0 || balance > 0;

  const firstName = customer.name.split(/\s+/)[0] || "there";

  return (
    <div className="container-page pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Account</p>
          <h1 className="h1 text-text">Kia ora, {firstName}</h1>
          <p className="mt-2 font-mono text-meta uppercase tracking-meta text-text-muted">
            {customer.email}
          </p>
        </div>
        <AccountSignOut />
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <PlayTimeProgress completedHours={completedHours} />
        {showBanked ? <BankedHoursCard balance={balance} /> : null}
        <RewardsList rewards={rewards} />
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <BookingList
          title="Upcoming sessions"
          bookings={upcoming}
          empty="Nothing booked yet."
        />
        <BookingList title="Past sessions" bookings={past} empty="No past sessions yet." />
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <Link href="/studio/book" className="btn btn-primary">
          Book another session
        </Link>
      </div>
    </div>
  );
}
