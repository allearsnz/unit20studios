"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Calendar } from "./Calendar";
import { OptionPicker } from "./OptionPicker";
import { SlotPicker } from "./SlotPicker";
import { GroupSize } from "./GroupSize";
import { DetailsForm } from "./DetailsForm";
import { TermsAccordion } from "./TermsAccordion";
import { BookingSummary } from "./BookingSummary";
import { DiscountField, type DiscountState } from "./DiscountField";
import { detailsSchema, type DetailsValues, type Slot } from "./types";
import {
  BULK_PACK,
  FLAT_LIMITS,
  FLAT_TIER,
  GROUP_SURCHARGE,
  WEEKDAY_DAYTIME_DEAL,
  bookingOption,
  calcBookingPriceCents,
  formatNZD,
  formatNZDPlusGst,
  formatNZDPlusGstIncl,
  isWeekdayDaytime,
  type BookingOption,
  type BookingOptionId,
} from "@/lib/pricing";
import { formatNZ } from "@/lib/timezone";
import { getStoredSource } from "@/lib/attribution";
import { cn } from "@/lib/utils";

const STEPS = ["Date", "Option", "Time", "Group", "Details", "Terms", "Review"];

const PACK_SUMMARY_NOTE = `10-hour pack: this books your first ${BULK_PACK.firstSessionHours} hours — the other ${BULK_PACK.packHours - BULK_PACK.firstSessionHours} are used across future visits, and we'll arrange them with you.`;

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

/** True when the option has at least one bookable start in `slots`. */
function optionStartExists(slots: Slot[], opt: BookingOption): boolean {
  return slots.some((s, i) => {
    if (!s.available) return false;
    for (let k = 1; k < opt.durationHours; k++) {
      if (!slots[i + k]?.available) return false;
    }
    if (opt.weekdayDaytimeOnly && !s.deal_2h) return false;
    return true;
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
  const [option, setOption] = useState<BookingOptionId | null>(null);
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [groupSize, setGroupSize] = useState(1);
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountState, setDiscountState] = useState<DiscountState>("idle");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
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
    setStartIdx(null);
    fetch(`/api/bookings/availability?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const next = (d.slots as Slot[]) ?? [];
        setSlots(next);
        // Drop an option the (new) day can no longer serve.
        setOption((o) => (o && !optionStartExists(next, bookingOption(o)) ? null : o));
      })
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  // Auto-fill the discount code from the ?code= link (from the offer email).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    if (fromUrl) setDiscountCode(fromUrl.trim().toUpperCase());
  }, []);

  // Live-validate the code (debounced). Purely UX — the server re-checks on submit.
  useEffect(() => {
    const code = discountCode.trim();
    if (!code) {
      setDiscountState("idle");
      setDiscountPercent(null);
      return;
    }
    setDiscountState("checking");
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/discounts/validate?code=${encodeURIComponent(code)}`)
        .then((r) => r.json())
        .then((d: { valid?: boolean; percent?: number }) => {
          if (cancelled) return;
          if (d.valid && d.percent) {
            setDiscountState("valid");
            setDiscountPercent(d.percent);
          } else {
            setDiscountState("invalid");
            setDiscountPercent(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDiscountState("invalid");
            setDiscountPercent(null);
          }
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [discountCode]);

  const tier = FLAT_TIER;
  const selectedOption = option ? bookingOption(option) : null;
  const duration = selectedOption?.durationHours ?? 0;
  const startSlot = startIdx !== null ? (slots[startIdx] ?? null) : null;
  const endSlot =
    startIdx !== null && duration ? (slots[startIdx + duration - 1] ?? null) : null;

  const price = option
    ? calcBookingPriceCents({
        tier,
        optionId: option,
        start: startSlot?.start ?? null,
        groupSize,
      })
    : null;
  const totalLabel = price ? formatNZDPlusGst(price.totalCents) : null;
  // Discount applies to the ex-GST subtotal (mirrors the server); the +GST
  // display is unchanged. Only reflected when the code has validated.
  const discountCents =
    price && discountState === "valid" && discountPercent
      ? Math.round((price.totalCents * discountPercent) / 100)
      : 0;
  const netCents = price ? price.totalCents - discountCents : null;
  const discountLabel = discountCents > 0 ? `−${formatNZDPlusGst(discountCents)}` : null;
  /** Total-to-pay (net of any discount) with the GST-inclusive amount alongside. */
  const totalWithGstLabel = netCents != null ? formatNZDPlusGstIncl(netCents) : null;
  const surchargeLabel =
    price && price.surchargeCents > 0 ? `+${formatNZDPlusGst(price.surchargeCents)}` : null;
  // Only flagged for the generic 2h option — picking a qualifying weekday
  // start still gets the cheaper rate. The daytime option says it already.
  const dealApplied =
    option === "2h" && !!startSlot && isWeekdayDaytime(startSlot.start, 2);

  const dateLabel = date ? civilLabel(date) : null;
  const timeLabel =
    startSlot && endSlot
      ? `${formatNZ(startSlot.start, "HH:mm")} – ${formatNZ(endSlot.end, "HH:mm")}`
      : null;

  const optionDisabledReason = (id: BookingOptionId): string | null => {
    if (loadingSlots) return "Checking availability…";
    const opt = bookingOption(id);
    if (optionStartExists(slots, opt)) return null;
    if (opt.weekdayDaytimeOnly && !slots.some((s) => s.deal_2h)) return "Mon–Fri only";
    return "No times left this day";
  };

  const scrollTop = () =>
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const canNext = useMemo(() => {
    if (step === 0) return !!date;
    if (step === 1) return !!option;
    if (step === 2) return startIdx !== null;
    if (step === 5) return agree;
    return true;
  }, [step, date, option, startIdx, agree]);

  const next = async () => {
    if (step === 4) {
      const ok = await trigger();
      if (!ok) return;
    }
    if (step === 5 && !agree) {
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

  const pickOption = (id: BookingOptionId) => {
    setOption(id);
    setStartIdx(null);
  };

  const submit = async () => {
    if (!option || !selectedOption || !startSlot || !date) return;
    if (!agree) {
      setStep(5);
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
          optionId: option,
          groupSize,
          name: v.name,
          email: v.email,
          phone: v.phone,
          dob: v.dob,
          customerNote: v.customerNote || null,
          discountCode: discountCode.trim() || null,
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
          setStep(2);
          setRefreshKey((k) => k + 1);
        }
        scrollTop();
        return;
      }
      if (typeof window !== "undefined" && window.fbq) {
        window.fbq("track", "Purchase", {
          value: (data.totalCents ?? price?.totalCents ?? 0) / 100,
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

  const timeHint = selectedOption?.isPack
    ? `You're booking the 10-hour pack (${formatNZD(BULK_PACK.totalCents)}+GST). Choose your first 2-hour session now — we'll sort the rest of your hours with you.`
    : selectedOption?.weekdayDaytimeOnly
      ? "Weekday-daytime starts only — your session runs inside 10am–4pm."
      : duration === 2
        ? "Pick a start time. Your session runs 2 hours from there."
        : "Pick a start time.";

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
              {label}
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
          <StepShell title="Pick a day" hint={`We open 90 days out. ${WEEKDAY_DAYTIME_DEAL.label}: 2 hours for ${formatNZDPlusGst(WEEKDAY_DAYTIME_DEAL.twoHourPriceCents)}.`}>
            <Calendar value={date} min={min} max={max} onChange={(d) => setDate(d)} />
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Pick your option"
            hint="One price covers the whole room. Need longer than 2 hours? Email studio@unit20.nz."
          >
            <OptionPicker
              value={option}
              onChange={pickOption}
              disabledReason={optionDisabledReason}
            />
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Pick your time" hint={timeHint}>
            <SlotPicker
              slots={slots}
              loading={loadingSlots}
              durationHours={duration || 1}
              requireDaytime={!!selectedOption?.weekdayDaytimeOnly}
              selectedIdx={startIdx}
              onSelect={setStartIdx}
            />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Your group"
            hint={`Up to ${FLAT_LIMITS.maxGroupSize} people. Groups of ${GROUP_SURCHARGE.threshold + 1}+ add ${formatNZD(GROUP_SURCHARGE.oneHourCents)}+GST (1 hour) or ${formatNZD(GROUP_SURCHARGE.twoHourCents)}+GST (2 hours) — added to your total automatically.`}
          >
            <div className="card p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-h3 font-semibold text-text">
                  {selectedOption?.label ?? tier.label}
                </h3>
                <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                  Whole room
                </span>
              </div>
              <p className="mono mt-5 text-2xl text-text">
                {totalLabel ?? formatNZDPlusGst(FLAT_TIER.peak_1h_price_cents)}
                <span className="ml-2 font-sans text-meta text-text-muted">
                  {selectedOption?.isPack ? `first ${duration}h now` : duration ? `${duration}h total` : "1h from"}
                </span>
              </p>
              {dealApplied ? (
                <p className="mt-2 font-mono text-meta uppercase tracking-meta text-accent">
                  {WEEKDAY_DAYTIME_DEAL.label} rate applied
                </p>
              ) : null}
              {surchargeLabel ? (
                <p className="mt-2 font-mono text-meta uppercase tracking-meta text-accent">
                  {surchargeLabel} group surcharge included
                </p>
              ) : null}
              <GroupSize
                value={groupSize}
                min={1}
                max={FLAT_LIMITS.maxGroupSize}
                onChange={setGroupSize}
              />
            </div>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell title="Your details" hint="First booking needs a quick ID check on arrival.">
            <DetailsForm register={register} errors={errors} />
          </StepShell>
        )}

        {step === 5 && (
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

        {step === 6 && (
          <StepShell title="Review & book" hint="Last look. Payment happens in person.">
            <ReviewList
              rows={[
                { label: "Date", value: dateLabel ?? "—" },
                { label: "Option", value: selectedOption?.label ?? "—" },
                { label: "Time", value: timeLabel ?? "—" },
                {
                  label: "Duration",
                  value: selectedOption?.isPack
                    ? `${duration}h now · ${BULK_PACK.packHours - duration}h to arrange`
                    : `${duration}h`,
                },
                { label: "Room", value: `${tier.label} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
                ...(surchargeLabel
                  ? [{ label: "Group surcharge", value: `${surchargeLabel} · included` }]
                  : []),
                { label: "Name", value: getValues("name") || "—" },
                { label: "Email", value: getValues("email") || "—" },
                ...(discountLabel
                  ? [{ label: `Discount${discountPercent ? ` (${discountPercent}%)` : ""}`, value: discountLabel }]
                  : []),
                { label: "Total", value: totalWithGstLabel ?? "—", accent: true },
              ]}
            />
            <DiscountField
              value={discountCode}
              state={discountState}
              percent={discountPercent}
              onChange={setDiscountCode}
            />
            {selectedOption?.isPack ? (
              <p className="mt-6 text-sm text-text-muted">{PACK_SUMMARY_NOTE}</p>
            ) : null}
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
          optionLabel={selectedOption?.label ?? null}
          timeLabel={timeLabel}
          durationHours={duration}
          tierLabel={option ? tier.label : null}
          groupSize={groupSize}
          surchargeLabel={surchargeLabel}
          discountLabel={discountLabel}
          totalLabel={totalWithGstLabel}
          dealNote={dealApplied ? WEEKDAY_DAYTIME_DEAL.label : null}
          packNote={selectedOption?.isPack ? PACK_SUMMARY_NOTE : null}
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
