"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Calendar } from "./Calendar";
import { SlotPicker } from "./SlotPicker";
import { GroupSize } from "./GroupSize";
import { DetailsForm } from "./DetailsForm";
import { TermsAccordion } from "./TermsAccordion";
import { BookingSummary } from "./BookingSummary";
import { MAX_HOURS, detailsSchema, type DetailsValues, type Selection, type Slot } from "./types";
import { BULK_PACK, FLAT_LIMITS, FLAT_TIER, calcPriceCents, formatNZD, formatNZDPlusGst } from "@/lib/pricing";
import { formatNZ } from "@/lib/timezone";
import { getStoredSource } from "@/lib/attribution";
import { cn } from "@/lib/utils";

const STEPS = ["Date", "Time", "Group", "Details", "Terms", "Review"];

function nzToday() {
  return formatNZ(new Date(), "yyyy-MM-dd");
}
function addDaysStr(base: string, days: number) {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function civilLabel(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function BookingFlow() {
  const router = useRouter();
  const min = nzToday();
  const max = addDaysStr(min, 90);

  const [step, setStep] = useState(0);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sel, setSel] = useState<Selection | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [agreeError, setAgreeError] = useState<string | undefined>();
  const topRef = useRef<HTMLDivElement>(null);

  const { register, formState: { errors }, trigger, getValues } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSel(null);
    fetch(`/api/bookings/availability?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSlots((d.slots as Slot[]) ?? []);
      })
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  const tier = FLAT_TIER;
  const duration = sel?.count ?? 0;
  const startSlot = sel ? slots[sel.startIdx] : null;
  const endSlot = sel ? slots[sel.startIdx + sel.count - 1] : null;

  const totalCents = calcPriceCents(tier, duration || 0);
  const totalLabel = duration ? formatNZDPlusGst(totalCents) : null;

  const dateLabel = date ? civilLabel(date) : null;
  const timeLabel =
    startSlot && endSlot
      ? `${formatNZ(startSlot.start, "HH:mm")} – ${formatNZ(endSlot.end, "HH:mm")}`
      : null;

  const isSelected = useCallback(
    (i: number) => !!sel && i >= sel.startIdx && i < sel.startIdx + sel.count,
    [sel],
  );

  const toggle = (i: number) =>
    setSel((prev) => {
      const slot = slots[i];
      if (!slot?.available) return prev;
      if (!prev) return { startIdx: i, count: 1 };
      const { startIdx, count } = prev;
      const end = startIdx + count - 1;
      if (i >= startIdx && i <= end) {
        if (count === 1) return null;
        if (i === end) return { startIdx, count: count - 1 };
        if (i === startIdx) return { startIdx: startIdx + 1, count: count - 1 };
        return { startIdx: i, count: 1 };
      }
      if (i === startIdx - 1 && count < MAX_HOURS) return { startIdx: i, count: count + 1 };
      if (i === end + 1 && count < MAX_HOURS) return { startIdx, count: count + 1 };
      return { startIdx: i, count: 1 };
    });

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const canNext = useMemo(() => {
    if (step === 0) return !!date;
    if (step === 1) return !!sel && sel.count >= 1;
    if (step === 4) return agree;
    return true;
  }, [step, date, sel, agree]);

  const next = async () => {
    if (step === 3) {
      const ok = await trigger();
      if (!ok) return;
    }
    if (step === 4 && !agree) {
      setAgreeError("Please accept the terms to continue.");
      return;
    }
    setAgreeError(undefined);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    scrollTop();
  };
  const back = () => {
    setStep((s) => Math.max(0, s - 1));
    scrollTop();
  };

  const submit = async () => {
    if (!sel || !startSlot || !date) return;
    if (!agree) {
      setStep(4);
      setAgreeError("Please accept the terms.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const v = getValues();
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startSlot.start,
          durationHours: duration,
          tierSlug: tier.slug,
          groupSize,
          name: v.name,
          email: v.email,
          phone: v.phone,
          dob: v.dob,
          customerNote: v.customerNote || null,
          agreeTerms: true,
          marketingOptIn: marketing,
          source: getStoredSource(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        if (res.status === 409) {
          setStep(1);
          setRefreshKey((k) => k + 1);
        }
        scrollTop();
        return;
      }
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "Purchase", {
          value: (data.totalCents ?? totalCents) / 100,
          currency: "NZD",
        });
      }
      router.push(`/studio/book/confirmation?id=${encodeURIComponent(data.friendlyId)}`);
    } catch {
      setSubmitError("Network error — check your connection and try again.");
      setSubmitting(false);
      scrollTop();
    }
  };

  return (
    <div ref={topRef} className="container-page grid gap-12 pb-24 pt-32 md:grid-cols-[1fr_360px] md:gap-16 md:pt-40">
      <div>
        <p className="eyebrow mb-3">Studio · Booking</p>
        <h1 className="h1 mb-9 text-text">Book a session</h1>

        {/* progress */}
        <ol className="mb-10 flex flex-wrap gap-x-5 gap-y-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                "font-mono text-meta uppercase tracking-meta transition-colors",
                i === step ? "text-accent" : i < step ? "text-text-muted" : "text-text-dim",
              )}
            >
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span> {label}
            </li>
          ))}
        </ol>

        {submitError ? (
          <div
            role="alert"
            className="mb-8 border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger"
          >
            {submitError}
          </div>
        ) : null}

        {step === 0 && (
          <StepShell title="Pick a day" hint="We open 90 days out. Off-peak is weekday daytime.">
            <Calendar value={date} min={min} max={max} onChange={(d) => setDate(d)} />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Pick your time"
            hint={`Tap an hour, or tap the next one to make it ${MAX_HOURS}. ${MAX_HOURS}-hour max online; need longer? Email studio@unit20.nz.`}
          >
            <SlotPicker slots={slots} loading={loadingSlots} isSelected={isSelected} onToggle={toggle} />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Your group" hint={`Up to ${FLAT_LIMITS.maxGroupSize} people. ${formatNZD(BULK_PACK.totalCents)}+GST for the 10-hour bulk pack — handy if you're practising weekly.`}>
            <div className="card p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-h3 font-semibold text-text">
                  {tier.label}
                </h3>
                <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                  Flat rate
                </span>
              </div>
              <p className="mono mt-5 text-2xl text-text">
                {totalLabel ?? formatNZDPlusGst(FLAT_TIER.peak_1h_price_cents)}
                <span className="ml-2 font-sans text-meta text-text-muted">
                  {duration ? `${duration}h total` : "1h from"}
                </span>
              </p>
              <GroupSize
                value={groupSize}
                min={1}
                max={FLAT_LIMITS.maxGroupSize}
                onChange={setGroupSize}
              />
              <p className="mt-5 font-mono text-meta uppercase tracking-meta text-text-muted">
                More than {FLAT_LIMITS.maxGroupSize} people? An additional fee may apply —{" "}
                <a
                  href="/contact?subject=Studio"
                  className="link text-accent"
                >
                  get in touch
                </a>
                .
              </p>
            </div>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Your details" hint="First booking needs a quick ID check on arrival.">
            <DetailsForm register={register} errors={errors} />
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="The terms" hint="Two minutes. Then you're booking.">
            <TermsAccordion
              agree={agree}
              marketing={marketing}
              onAgree={setAgree}
              onMarketing={setMarketing}
              error={agreeError}
            />
          </StepShell>
        )}

        {step === 5 && (
          <StepShell title="Review & book" hint="Last look. Payment happens in person.">
            <ReviewList
              rows={[
                { label: "Date", value: dateLabel ?? "—" },
                { label: "Time", value: timeLabel ?? "—" },
                { label: "Duration", value: `${duration}h` },
                { label: "Room", value: `${tier.label} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
                { label: "Name", value: getValues("name") || "—" },
                { label: "Email", value: getValues("email") || "—" },
                { label: "Total", value: totalLabel ?? "—", accent: true },
              ]}
            />
          </StepShell>
        )}

        {/* nav */}
        <div className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-8">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-secondary" disabled={submitting}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              aria-disabled={!canNext}
              disabled={!canNext}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting} className="btn btn-primary">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Booking…
                </>
              ) : (
                <>
                  Confirm booking
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <aside className="md:sticky md:top-28 md:self-start">
        <BookingSummary
          dateLabel={dateLabel}
          timeLabel={timeLabel}
          durationHours={duration}
          tierLabel={duration ? tier.label : null}
          groupSize={groupSize}
          totalLabel={totalLabel}
        />
      </aside>
    </div>
  );
}

function StepShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="h2 text-text">{title}</h2>
      <p className="lead mt-2">{hint}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function ReviewList({
  rows,
}: {
  rows: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <dl className="border-t border-border">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-6 border-b border-border py-4">
          <dt className="font-mono text-meta uppercase tracking-meta text-text-muted">{r.label}</dt>
          <dd className={cn("text-right", r.accent ? "mono text-xl text-accent" : "text-text")}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
