"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  BANKED_OPTIONS,
  TIER_SLUG,
  bookingOption,
  bookingOptions,
  calcBookingPriceCents,
  formatNZD,
  formatNZDPlusGst,
  formatNZDPlusGstIncl,
  formatHour,
  weekdayDealApplies,
  type BookingOption,
  type BookingOptionId,
  type PricingSettings,
} from "@/lib/pricing";
import { formatNZ } from "@/lib/timezone";
import { MIN_NOTICE_HOURS, MIN_NOTICE_NOTE } from "@/lib/booking-window";
import { getStoredSource } from "@/lib/attribution";
import { cn } from "@/lib/utils";

/** Signed-in account context — prefills details and unlocks banked options. */
export type BookingAccount = {
  name: string;
  email: string;
  phone: string;
  dob: string;
  bankedHours: number;
};

/**
 * Named so the indices below can never drift apart again. Group used to be a
 * screen of its own that defaulted to 1 and let you straight through, and Terms
 * was a screen holding one checkbox — two taps that asked nothing. They now sit
 * inside Details and Review respectively.
 *
 * Order is load-bearing: the slot list is fetched from `date`, so Date must
 * come before Option (every option card is disabled while `slots` is empty).
 */
const STEP = { DATE: 0, OPTION: 1, TIME: 2, DETAILS: 3, REVIEW: 4 } as const;

/** Visual order of the details fields — used to focus the first invalid one. */
const DETAIL_FIELDS = ["name", "email", "phone", "dob", "customerNote"] as const satisfies readonly (keyof DetailsValues)[];
const STEPS = ["Date", "Option", "Time", "Details", "Review"];


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

/** Step cross-fade + scroll run for the same time, so they read as one move. */
const STEP_MS = 260;

/**
 * Tween the window scroll ourselves instead of `scrollIntoView({ behavior:
 * "smooth" })`. The native curve runs on its own clock — noticeably longer than
 * the step transition — so the page was still travelling after the new step had
 * settled, which is the drift that read as a stall. This lands with it.
 */
function scrollWindowTo(top: number, duration: number) {
  const from = window.scrollY;
  const delta = top - from;
  // A hidden tab never fires rAF, so the tween would never tick — jump instead.
  if (duration <= 0 || Math.abs(delta) < 2 || document.hidden) {
    window.scrollTo(0, top);
    return;
  }
  const started = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - started) / duration);
    // Ease-out quint — the same settle as the site's [0.22, 1, 0.36, 1].
    window.scrollTo(0, from + delta * (1 - Math.pow(1 - p, 5)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function BookingFlow({
  account,
  pricing,
}: {
  account?: BookingAccount | null;
  /** The live price list, read on the server and handed down (see
   *  `lib/pricing-settings.ts`). Everything money-shaped on this screen — the
   *  option cards, the hints, the running total — comes from here. */
  pricing: PricingSettings;
}) {
  const router = useRouter();
  const min = nzToday();
  const max = addDaysStr(min, 90);

  const bankedHours = account?.bankedHours ?? 0;
  const packSummaryNote = `${pricing.pack.packHours}-hour pack: this books your first ${pricing.pack.firstSessionHours} hours — the other ${pricing.pack.packHours - pricing.pack.firstSessionHours} bank to your account, and you can draw them down whenever suits.`;

  // Whatever's switched on right now; banked options only when the balance
  // covers them.
  const availableOptions = useMemo<BookingOption[]>(() => {
    const banked = bankedHours > 0 ? BANKED_OPTIONS.filter((o) => bankedHours >= o.durationHours) : [];
    return [...bookingOptions(pricing), ...banked];
  }, [bankedHours, pricing]);

  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  /** Travel direction, so the step transition leans the way you're going. */
  const [dir, setDir] = useState<1 | -1>(1);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  /** When the room is already being opened on the chosen day (ISO), if it is —
   *  that's what lets late starts through, so the hints have to say it. */
  const [opensAt, setOpensAt] = useState<string | null>(null);
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

  const { register, formState: { errors }, trigger, getValues, setFocus, getFieldState } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    mode: "onBlur",
    defaultValues: account
      ? {
          name: account.name || "",
          email: account.email || "",
          phone: account.phone || "",
          dob: account.dob || "",
          customerNote: "",
        }
      : undefined,
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
        setOpensAt((d.opensAt as string | null) ?? null);
        // Drop an option the (new) day can no longer serve.
        setOption((o) => (o && !optionStartExists(next, bookingOption(pricing, o)) ? null : o));
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setOpensAt(null);
      })
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey, pricing]);

  // Read the ?code= link (from the offer email) and ?option= (from the pricing
  // page CTAs — someone who tapped "Book the 10-hour pack" has already chosen,
  // and making them choose again on step 2 was throwing that away).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("code");
    if (fromUrl) setDiscountCode(fromUrl.trim().toUpperCase());

    const wanted = params.get("option");
    if (wanted && availableOptions.some((o) => o.id === wanted)) {
      setOption(wanted as BookingOptionId);
    }
  }, [availableOptions]);

  const selectedOption = option ? bookingOption(pricing, option) : null;
  const usesBanked = !!selectedOption?.usesBankedHours;

  // Live-validate the code (debounced). Purely UX — the server re-checks on
  // submit. Skipped for banked bookings (codes never combine with hours). Sends
  // the chosen option so a standard-only reward code can flag the pack.
  useEffect(() => {
    const code = discountCode.trim();
    if (!code || usesBanked) {
      setDiscountState("idle");
      setDiscountPercent(null);
      return;
    }
    setDiscountState("checking");
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/discounts/validate?code=${encodeURIComponent(code)}&option=${option ?? ""}`)
        .then((r) => r.json())
        .then((d: { valid?: boolean; percent?: number; reason?: string }) => {
          if (cancelled) return;
          if (d.valid && d.percent) {
            setDiscountState("valid");
            setDiscountPercent(d.percent);
          } else if (d.reason === "standard_only") {
            setDiscountState("standard_only");
            setDiscountPercent(null);
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
  }, [discountCode, option, usesBanked]);

  const roomLabel = pricing.room.label;
  const duration = selectedOption?.durationHours ?? 0;
  const startSlot = startIdx !== null ? (slots[startIdx] ?? null) : null;
  const endSlot =
    startIdx !== null && duration ? (slots[startIdx + duration - 1] ?? null) : null;

  const price = option
    ? calcBookingPriceCents({
        settings: pricing,
        optionId: option,
        start: startSlot?.start ?? null,
        groupSize,
      })
    : null;
  const totalLabel = price ? formatNZDPlusGst(price.totalCents) : null;
  // Discount applies to the ex-GST subtotal (mirrors the server); the +GST
  // display is unchanged. Only reflected when the code validated AND this isn't
  // a banked booking (codes never combine with prepaid hours).
  const discountCents =
    !usesBanked && price && discountState === "valid" && discountPercent
      ? Math.round((price.totalCents * discountPercent) / 100)
      : 0;
  const netCents = price ? price.totalCents - discountCents : null;
  const discountLabel = discountCents > 0 ? `−${formatNZDPlusGst(discountCents)}` : null;
  const surchargeLabel =
    price && price.surchargeCents > 0 ? `+${formatNZDPlusGst(price.surchargeCents)}` : null;

  // Banked-hours display: the session itself is free; only a group surcharge (if
  // any) is payable in person.
  const bankedRemainingAfter =
    usesBanked && account ? Math.max(0, account.bankedHours - duration) : null;
  const totalWithGstLabel = usesBanked
    ? price && price.surchargeCents > 0
      ? `${formatNZDPlusGstIncl(price.surchargeCents)} · surcharge`
      : "Covered by banked hours"
    : netCents != null
      ? formatNZDPlusGstIncl(netCents)
      : null;

  // Only flagged for the generic 2h option — picking a qualifying weekday
  // start still gets the cheaper rate. The daytime option says it already.
  const dealApplied =
    option === "2h" && !!startSlot && weekdayDealApplies(pricing, startSlot.start, 2);

  // A signed-in account has already been ID-verified (that's what unlocks it),
  // so anyone else is booking for the first time as far as this flow knows.
  const isFirstBooking = !account;

  const dateLabel = date ? civilLabel(date) : null;
  const timeLabel =
    startSlot && endSlot
      ? `${formatNZ(startSlot.start, "HH:mm")} – ${formatNZ(endSlot.end, "HH:mm")}`
      : null;

  const optionDisabledReason = (id: BookingOptionId): string | null => {
    if (loadingSlots) return "Checking availability…";
    const opt = bookingOption(pricing, id);
    if (optionStartExists(slots, opt)) return null;
    if (opt.weekdayDaytimeOnly && !slots.some((s) => s.deal_2h)) return "Mon–Fri only";
    return "No times left this day";
  };

  // Today reads differently everywhere: the API has already dropped every start
  // inside the minimum-notice window, so "nothing left" here doesn't mean the
  // room was booked out — it usually means the day has simply run past it.
  const dateIsToday = date === min;

  // Every option unavailable = the day is the problem, not the choice.
  const dayIsFull =
    !loadingSlots && slots.length > 0 && availableOptions.every((o) => !optionStartExists(slots, o));

  const scrollTop = () => {
    const el = topRef.current;
    if (!el) return;
    const { top } = el.getBoundingClientRect();
    // Already looking at the top of the flow — scrolling here is what read as a
    // stall: half a second of animation that goes nowhere.
    if (top >= -4) return;
    scrollWindowTo(Math.max(0, window.scrollY + top), reduce ? 0 : STEP_MS);
  };

  // Scroll on a step change AFTER React has committed the new step. Doing it in
  // the click handler measured the OUTGOING step's layout, so the browser
  // started animating toward a target that moved the instant the taller/shorter
  // step rendered — the stall-then-jump.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scrollTop();
    // scrollTop is stable enough for this — it only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const canNext = useMemo(() => {
    if (step === STEP.DATE) return !!date;
    if (step === STEP.OPTION) return !!option;
    if (step === STEP.TIME) return startIdx !== null;
    return true;
    // `agree` is no longer here: the terms tick now lives on Review, where it
    // gates submit rather than Continue.
  }, [step, date, option, startIdx]);

  const next = async () => {
    if (step === STEP.DETAILS) {
      const ok = await trigger();
      if (!ok) {
        // RHF validates but does not focus. Without this the button looks
        // broken: nothing moves, and on a phone the offending field is often
        // off-screen above the fold.
        //
        // Ask for field state rather than reading the `errors` object closed
        // over from the last render — that one is still empty at this point,
        // which is why the first version of this silently did nothing.
        const first = DETAIL_FIELDS.find((f) => getFieldState(f).invalid);
        if (first) setFocus(first, { shouldSelect: true });
        return;
      }
    }
    setAgreeError(undefined);
    setDir(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const pickOption = (id: BookingOptionId) => {
    setOption(id);
    setStartIdx(null);
  };

  const submit = async () => {
    if (!option || !selectedOption || !startSlot || !date) return;
    if (!agree) {
      setStep(STEP.REVIEW);
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
          tierSlug: TIER_SLUG,
          optionId: option,
          groupSize,
          name: v.name,
          email: v.email,
          phone: v.phone,
          dob: v.dob,
          customerNote: v.customerNote || null,
          // Banked bookings never carry a discount code.
          discountCode: usesBanked ? null : discountCode.trim() || null,
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
          setDir(-1);
          setStep(STEP.TIME);
          setRefreshKey((k) => k + 1);
          // The step effect scrolls once the time picker has rendered.
        } else {
          scrollTop();
        }
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

  const timeHint = usesBanked
    ? `This session uses ${duration} of your ${bankedHours} banked hours${bankedRemainingAfter != null ? ` — ${bankedRemainingAfter} left after` : ""}. Pick a start time.`
    : selectedOption?.isPack
      ? `You're booking the ${pricing.pack.packHours}-hour pack (${formatNZD(pricing.pack.totalCents)}+GST). Choose your first ${pricing.pack.firstSessionHours}-hour session now — the rest banks to your account.`
      : selectedOption?.weekdayDaytimeOnly
        ? `Weekday-daytime starts only — your session runs inside ${formatHour(pricing.weekdayDeal.windowStartHour)}–${formatHour(pricing.weekdayDeal.windowEndHour)}.`
        : duration === 2
          ? "Pick a start time. Your session runs 2 hours from there."
          : "Pick a start time.";

  // Same rule, said out loud on the day it bites — and only in the version
  // that's true. On a day someone's already booked, the 4 hours don't apply
  // from their start onwards, so saying they do would be a lie the grid
  // visibly contradicts.
  const timeHintWithNotice = !dateIsToday
    ? timeHint
    : opensAt
      ? `${timeHint} The room's already open today from ${formatNZ(opensAt, "h:mmaaa")}, so later starts are yours at short notice.`
      : `${timeHint} ${MIN_NOTICE_NOTE}`;

  // Group-step price line.
  const groupCardPrice = usesBanked
    ? price && price.surchargeCents > 0
      ? formatNZDPlusGst(price.surchargeCents)
      : "Banked hours"
    : (totalLabel ?? formatNZDPlusGst(pricing.rates.oneHourCents));
  const groupCardSub = usesBanked
    ? `${duration}h · banked`
    : selectedOption?.isPack
      ? `first ${duration}h now`
      : duration
        ? `${duration}h total`
        : "1h from";

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

        {/*
          Step transition. `popLayout` pulls the outgoing step out of the flow
          the moment it starts leaving, so the incoming step's height applies
          straight away — without it the nav below collapses to zero and springs
          back between steps. The two cross-fade over each other and lean the
          way you're travelling.
        */}
        <div className="relative">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={step}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -20 }}
            transition={{
              duration: reduce ? 0 : STEP_MS / 1000,
              ease: [0.22, 1, 0.36, 1],
              opacity: { duration: reduce ? 0 : 0.18 },
            }}
          >
          {step === STEP.DATE && (
            <StepShell
              title="Pick a day"
              hint={`We open 90 days out. A session on a quiet day needs ${MIN_NOTICE_HOURS} hours' notice — less on a day the room's already open.${
                pricing.weekdayDeal.enabled
                  ? ` ${pricing.weekdayDeal.label}: 2 hours for ${formatNZDPlusGst(pricing.weekdayDeal.twoHourPriceCents)}.`
                  : ""
              }`}
            >
              <Calendar value={date} min={min} max={max} onChange={(d) => setDate(d)} />
            </StepShell>
          )}

          {step === STEP.OPTION && (
            <StepShell
              title="Pick your option"
              hint={
                bankedHours > 0
                  ? `You've got ${bankedHours} banked hours — book with those, or pick a standard option. Need longer than 2 hours? Email studio@unit20.nz.`
                  : "One price covers the whole room. Need longer than 2 hours? Email studio@unit20.nz."
              }
            >
              {dayIsFull ? (
                <div className="card p-7">
                  <h3 className="font-display text-h3 font-semibold text-text">
                    {dateIsToday ? "Nothing left today." : `${dateLabel} is fully booked.`}
                  </h3>
                  <p className="lead mt-3 text-sm text-pretty">
                    {dateIsToday && !opensAt ? (
                      <>
                        We need {MIN_NOTICE_HOURS} hours&apos; notice to have the
                        room set up for you, so today&apos;s starts have gone —
                        unless the room was taken or the decks are out on a job
                        anyway. Pick another day and you&apos;re away.
                      </>
                    ) : (
                      <>
                        Nothing left on that day — either the room is taken or
                        the decks are out on a job. Pick another day and
                        you&apos;re away.
                      </>
                    )}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDir(-1);
                        setStep(STEP.DATE);
                      }}
                      className="btn btn-primary"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden />
                      Pick another day
                    </button>
                    <a href="/contact?subject=Studio" className="btn btn-secondary">
                      Ask us about it
                    </a>
                  </div>
                </div>
              ) : (
                <OptionPicker
                  options={availableOptions}
                  value={option}
                  onChange={pickOption}
                  disabledReason={optionDisabledReason}
                />
              )}
            </StepShell>
          )}

          {step === STEP.TIME && (
            <StepShell title="Pick your time" hint={timeHintWithNotice}>
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

          {step === STEP.DETAILS && (
            <StepShell
              title="Your details"
              hint={`Up to ${pricing.room.maxGroupSize} people.${
                pricing.groupSurcharge.threshold < pricing.room.maxGroupSize
                  ? ` Groups of ${pricing.groupSurcharge.threshold + 1}+ add ${formatNZD(pricing.groupSurcharge.oneHourCents)}+GST (1 hour) or ${formatNZD(pricing.groupSurcharge.twoHourCents)}+GST (2 hours), added automatically.`
                  : ""
              }`}
            >
              <div className="card p-7">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-h3 font-semibold text-text">
                    {selectedOption?.label ?? roomLabel}
                  </h3>
                  <span className="font-mono text-meta uppercase tracking-meta text-text-dim">
                    Whole room
                  </span>
                </div>
                <p className="mono mt-5 text-2xl text-text">
                  {groupCardPrice}
                  <span className="ml-2 font-sans text-meta text-text-muted">{groupCardSub}</span>
                </p>
                {dealApplied ? (
                  <p className="mt-2 font-mono text-meta uppercase tracking-meta text-accent">
                    {pricing.weekdayDeal.label} rate applied
                  </p>
                ) : null}
                {surchargeLabel ? (
                  <p className="mt-2 font-mono text-meta uppercase tracking-meta text-accent">
                    {surchargeLabel} group surcharge{usesBanked ? " · payable in person" : " included"}
                  </p>
                ) : null}
                <GroupSize
                  value={groupSize}
                  min={1}
                  max={pricing.room.maxGroupSize}
                  onChange={setGroupSize}
                />
              </div>

              <div className="mt-6">
                <DetailsForm register={register} errors={errors} />
              </div>
            </StepShell>
          )}

          {step === STEP.REVIEW && (
            <StepShell
              title="Review & book"
              hint={
                isFirstBooking
                  ? "Last look. We'll hold this slot and email you a link to upload photo ID — that's what confirms it. Payment happens in person."
                  : "Last look. Payment happens in person."
              }
            >
              <ReviewList
                rows={[
                  { label: "Date", value: dateLabel ?? "—" },
                  { label: "Option", value: selectedOption?.label ?? "—" },
                  { label: "Time", value: timeLabel ?? "—" },
                  {
                    label: "Duration",
                    value: selectedOption?.isPack
                      ? `${duration}h now · ${pricing.pack.packHours - duration}h banked`
                      : `${duration}h`,
                  },
                  { label: "Room", value: `${roomLabel} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
                  ...(usesBanked
                    ? [
                        {
                          label: "Banked hours",
                          value: `−${duration}h · ${bankedRemainingAfter ?? 0}h left after`,
                        },
                      ]
                    : []),
                  ...(surchargeLabel
                    ? [
                        {
                          label: "Group surcharge",
                          value: `${surchargeLabel}${usesBanked ? " · in person" : " · included"}`,
                        },
                      ]
                    : []),
                  { label: "Name", value: getValues("name") || "—" },
                  { label: "Email", value: getValues("email") || "—" },
                  ...(discountLabel
                    ? [{ label: `Discount${discountPercent ? ` (${discountPercent}%)` : ""}`, value: discountLabel }]
                    : []),
                  { label: "Total", value: totalWithGstLabel ?? "—", accent: true },
                ]}
              />
              {usesBanked ? null : (
                <DiscountField
                  value={discountCode}
                  state={discountState}
                  percent={discountPercent}
                  onChange={setDiscountCode}
                />
              )}
              {selectedOption?.isPack ? (
                <p className="mt-6 text-sm text-text-muted">{packSummaryNote}</p>
              ) : null}

              <div className="mt-8 border-t border-border pt-8">
                <TermsAccordion
                  agree={agree}
                  marketing={marketing}
                  onAgree={setAgree}
                  onMarketing={setMarketing}
                  error={agreeError}
                />
              </div>
            </StepShell>
          )}
          </motion.div>
        </AnimatePresence>
        </div>

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
                  {isFirstBooking ? "Request this session" : "Confirm booking"}
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
          tierLabel={option ? roomLabel : null}
          groupSize={groupSize}
          surchargeLabel={surchargeLabel}
          discountLabel={discountLabel}
          totalLabel={totalWithGstLabel}
          dealNote={dealApplied ? pricing.weekdayDeal.label : null}
          packNote={selectedOption?.isPack ? packSummaryNote : usesBanked ? "Paid with your banked hours." : null}
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
