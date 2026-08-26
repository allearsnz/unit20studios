import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/customer-auth";
import { bookingProgress } from "@/lib/booking-progress";
import { BookingProgress } from "@/components/account/BookingProgress";
import { CreateAccountCta } from "@/components/account/CreateAccountCta";
import { formatBookingWhen } from "@/lib/timezone";
import {
  formatNZDPlusGst,
  formatNZDPlusGstIncl,
  groupSurchargeCents,
} from "@/lib/pricing";
import { getPricingSettings } from "@/lib/pricing-store";
import { site } from "@/lib/site";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

// Reads the session to decide whether to offer an account, and the booking row
// changes as it moves through confirmation — neither survives caching.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmation",
  robots: { index: false, follow: false },
};

type ConfirmBooking = {
  friendly_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  total_price_cents: number;
  group_size: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  access_sent_at: string | null;
  banked_hours_used: number;
  pricing_tier: { label: string } | { label: string }[] | null;
  customer: { id_verified: boolean } | { id_verified: boolean }[] | null;
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  // In parallel: the booking, and whether they're already signed in. The second
  // decides only whether to show the sign-up card, so it must never hold up the
  // first — and a failure to read it must never cost anyone their confirmation.
  const [booking, session, pricing] = await Promise.all([
    loadBooking(id),
    getCustomerSession().catch(() => null),
    getPricingSettings(),
  ]);

  const confirmed = booking?.status === "confirmed";
  const tierLabel = Array.isArray(booking?.pricing_tier)
    ? booking?.pricing_tier[0]?.label
    : booking?.pricing_tier?.label;
  const customer = Array.isArray(booking?.customer)
    ? booking?.customer[0]
    : booking?.customer;

  const progress = booking
    ? bookingProgress({
        status: booking.status,
        payment_status: booking.payment_status,
        start_time: booking.start_time,
        end_time: booking.end_time,
        access_sent_at: booking.access_sent_at,
        idVerified: customer?.id_verified ?? false,
        banked: booking.banked_hours_used > 0,
      })
    : null;
  // A pack booking carries the full pack price as its total — no ordinary
  // 1–2h booking gets anywhere near it.
  const isPack = !!booking && booking.total_price_cents >= pricing.pack.totalCents;
  const surcharge = booking
    ? groupSurchargeCents(pricing, booking.duration_hours, booking.group_size)
    : 0;

  return (
    <section className="container-page flex min-h-[80vh] flex-col justify-center py-32 md:py-40">
      <div className="mx-auto w-full max-w-xl">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-accent text-accent">
          {confirmed ? <Check className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
        </span>

        <h1 className="display mt-8 text-text">
          {confirmed ? "You're booked." : booking ? "Request received." : "Thanks."}
        </h1>

        <p className="lead mt-5 max-w-md text-pretty">
          {confirmed
            ? "Your session is locked in. We've emailed the details with a calendar invite — see you in the booth."
            : booking
              ? "We've got your booking request. Since it's your first session, bring photo ID when you arrive and we'll confirm you on the spot. Check your email for the details."
              : id
                ? `We've recorded your booking (${id}). Check your email for the full details.`
                : "We couldn't find that booking reference. Check your email for confirmation, or get in touch."}
        </p>

        {progress ? (
          <div className="mt-10 border-t border-border pt-8">
            <p className="eyebrow mb-6">Where it&apos;s up to</p>
            <BookingProgress progress={progress} />
          </div>
        ) : null}

        {booking ? (
          <dl className="mt-10 border-t border-border">
            <Row label="Reference" value={booking.friendly_id} mono />
            <Row label="When" value={formatBookingWhen(booking.start_time, booking.end_time)} />
            <Row
              label="Where"
              value={`${site.address.street}, ${site.address.locality}`}
            />
            <Row
              label="Duration"
              value={
                isPack
                  ? `${booking.duration_hours}h now · ${pricing.pack.packHours - booking.duration_hours}h to arrange`
                  : `${booking.duration_hours}h`
              }
            />
            {tierLabel ? (
              <Row label="Room" value={`${tierLabel} · ${booking.group_size} people`} />
            ) : null}
            {isPack ? (
              <Row label="Rate" value={`10-hour pack — first ${booking.duration_hours}h booked`} />
            ) : null}
            {surcharge > 0 ? (
              <Row
                label="Group surcharge"
                value={`+${formatNZDPlusGst(surcharge)} · included in total`}
              />
            ) : null}
            <Row
              label="Total"
              value={`${formatNZDPlusGstIncl(booking.total_price_cents)} · pay in person`}
              accent
            />
          </dl>
        ) : null}

        {booking && isPack ? (
          <p className="mt-6 max-w-md text-sm text-text-muted">
            You&apos;re on the {pricing.pack.packHours}-hour pack — this booking uses your first{" "}
            {booking.duration_hours} hours. The remaining{" "}
            {pricing.pack.packHours - booking.duration_hours} hours are used across
            future visits; we&apos;ll be in touch to arrange them with you.
          </p>
        ) : null}

        {booking ? (
          <p className="mt-6 max-w-md text-sm text-text-muted">
            On the day, come to {site.address.street} at your booking time —
            someone from Unit 20 will meet you there and let you in. Bring a USB
            with your tracks, your own headphones, and photo ID if it&apos;s your
            first visit.
          </p>
        ) : null}

        <div className="mt-10 flex flex-wrap gap-3">
          {booking ? (
            <a
              href={`/api/bookings/${booking.friendly_id}/ics`}
              className="btn btn-primary"
              download
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Add to calendar
            </a>
          ) : null}
          <Link href="/" className="btn btn-secondary">
            Back to the studio
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <p className="mt-10 text-sm text-text-dim">
          Need to change something? Reply to your confirmation email or write to{" "}
          <a href="mailto:studio@unit20.nz" className="link text-text-muted">
            studio@unit20.nz
          </a>
          .
        </p>

        {/* Signed out and we actually have a booking to attach: offer the
            account. Signed in: point at the dashboard instead, because the
            hours from this session are about to appear on it. */}
        {booking ? (
          session ? (
            <Link
              href="/account"
              className="mt-12 flex items-center justify-between gap-4 border border-border bg-bg-elev px-5 py-4 transition-colors hover:border-border-strong"
            >
              <span>
                <span className="block font-mono text-[11px] uppercase tracking-meta text-text-muted">
                  Your account
                </span>
                <span className="mt-1 block text-sm text-text">
                  This session and your play time are on your dashboard.
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            </Link>
          ) : (
            <CreateAccountCta hoursBooked={booking.duration_hours} />
          )
        ) : null}
      </div>
    </section>
  );
}

async function loadBooking(id: string | undefined): Promise<ConfirmBooking | null> {
  if (!id) return null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("bookings")
      .select(
        "friendly_id,start_time,end_time,duration_hours,total_price_cents,group_size," +
          "status,payment_status,access_sent_at,banked_hours_used," +
          "pricing_tier:pricing_tiers(label),customer:customers(id_verified)",
      )
      .eq("friendly_id", id)
      .maybeSingle();
    return (data as ConfirmBooking | null) ?? null;
  } catch {
    return null;
  }
}

function Row({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-4">
      <dt className="font-mono text-meta uppercase tracking-meta text-text-muted">{label}</dt>
      <dd
        className={`text-right ${accent ? "mono text-lg text-accent" : mono ? "mono text-text" : "text-text"}`}
      >
        {value}
      </dd>
    </div>
  );
}
