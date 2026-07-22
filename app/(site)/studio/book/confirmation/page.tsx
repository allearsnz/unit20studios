import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBookingWhen } from "@/lib/timezone";
import {
  BULK_PACK,
  formatNZDPlusGst,
  formatNZDPlusGstIncl,
  groupSurchargeCents,
} from "@/lib/pricing";
import { site } from "@/lib/site";

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
  status: string;
  pricing_tier: { label: string } | { label: string }[] | null;
};

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  let booking: ConfirmBooking | null = null;
  if (id) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("bookings")
        .select(
          "friendly_id,start_time,end_time,duration_hours,total_price_cents,group_size,status, pricing_tier:pricing_tiers(label)",
        )
        .eq("friendly_id", id)
        .maybeSingle();
      booking = (data as ConfirmBooking | null) ?? null;
    } catch {
      booking = null;
    }
  }

  const confirmed = booking?.status === "confirmed";
  const tierLabel = Array.isArray(booking?.pricing_tier)
    ? booking?.pricing_tier[0]?.label
    : booking?.pricing_tier?.label;
  // A 10-hour pack booking carries the full pack price as its total — no
  // ordinary 1–2h booking gets anywhere near it.
  const isPack = !!booking && booking.total_price_cents >= BULK_PACK.totalCents;
  const surcharge = booking
    ? groupSurchargeCents(booking.duration_hours, booking.group_size)
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
                  ? `${booking.duration_hours}h now · ${BULK_PACK.packHours - booking.duration_hours}h to arrange`
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
            You&apos;re on the 10-hour pack — this booking uses your first{" "}
            {booking.duration_hours} hours. The remaining{" "}
            {BULK_PACK.packHours - booking.duration_hours} hours are used across
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
      </div>
    </section>
  );
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
