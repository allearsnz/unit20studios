import { AlertTriangle, Check, RotateCcw } from "lucide-react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { resetPricing, savePricing } from "@/app/admin/actions";
import { readPricingSettings } from "@/lib/pricing-store";
import {
  bookingOptions,
  calcBookingPriceCents,
  formatHour,
  formatNZD,
  formatNZDPlusGst,
  formatNZDPlusGstIncl,
  gstInclusiveCents,
  packHourlyCents,
  type BookingOptionId,
} from "@/lib/pricing";
import { formatNZ } from "@/lib/timezone";

export const dynamic = "force-dynamic";

/**
 * The price list, editable.
 *
 * Everything the customer is ever quoted comes from this one form: the option
 * cards in the booking flow, the rows on /studio/pricing, the totals on
 * bookings and invoices, the numbers in the emails. Saving rewrites the
 * marketing pages too — there is no second copy of a price to go and update.
 *
 * Money is typed in dollars EX-GST, which is how the studio quotes it; the
 * GST-inclusive figure is shown beside each field so the amount someone
 * actually hands over is never a mental sum.
 */
export default async function PricingAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; warn?: string }>;
}) {
  const [{ settings: p, stored, reason, updatedAt }, params] = await Promise.all([
    readPricingSettings(),
    searchParams,
  ]);

  const options = bookingOptions(p);
  const optionIds = ["1h", "2h", "2h-daytime", "pack10"] as const;

  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Pricing</h1>
      <p className="lead mt-2 max-w-2xl">
        Every price the site quotes lives here — the booking options, the weekday
        deal, the pack, the group surcharge. Save and it&apos;s live: the booking
        flow, the pricing page and the landing page all rewrite themselves. Prices
        are ex-GST, the way you quote them.
      </p>

      {params.saved ? (
        <Banner tone="ok" icon={<Check className="h-4 w-4" aria-hidden />}>
          Saved. The site is on these prices now.
        </Banner>
      ) : null}
      {params.error ? (
        <Banner tone="bad" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
          {params.error}
        </Banner>
      ) : null}
      {params.warn ? (
        <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
          {params.warn}
        </Banner>
      ) : null}
      {!stored ? (
        <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
          {reason === "no_table"
            ? "The studio_settings table doesn't exist yet — run supabase/migrations/0015_studio_settings.sql. Until then the site is running on the built-in defaults shown below, and saving will fail."
            : reason === "not_configured"
              ? "Supabase isn't configured in this environment, so these are the built-in defaults and nothing can be saved."
              : reason === "no_row"
                ? "No saved price list yet — these are the built-in defaults. Saving creates the row."
                : "Couldn't read the saved price list, so these are the built-in defaults. Check the logs before saving over it."}
        </Banner>
      ) : null}

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.35fr_0.65fr]">
        <form action={savePricing} className="space-y-6">
          {/* ---- The room ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">The room</h2>
            <p className="mb-5 text-sm text-text-muted">
              The label shows as the &quot;Room&quot; line on bookings, emails and the
              confirmation page. The maximum is the hard cap on the group-size
              stepper — the booking API refuses anything above it.
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Room label" name="room_label">
                <input id="room_label" name="room_label" defaultValue={p.room.label} className="input mt-2" required />
              </Field>
              <Field label="Max group size" name="room_max_group">
                <input
                  id="room_max_group"
                  name="room_max_group"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={p.room.maxGroupSize}
                  className="input mt-2"
                  required
                />
              </Field>
            </div>
          </section>

          {/* ---- Standard rates ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">Standard rates</h2>
            <p className="mb-5 text-sm text-text-muted">
              What a session costs when no deal applies. Flat hourly pricing means
              the 2-hour figure is simply twice the 1-hour one — but it doesn&apos;t
              have to be.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                label="1 hour"
                name="rate_1h"
                cents={p.rates.oneHourCents}
                hint={`${formatNZDPlusGst(p.rates.oneHourCents)} · ${formatNZD(gstInclusiveCents(p.rates.oneHourCents))} to pay`}
              />
              <MoneyField
                label="2 hours"
                name="rate_2h"
                cents={p.rates.twoHourCents}
                hint={`${formatNZD(Math.round(p.rates.twoHourCents / 2))}/hr · ${formatNZD(gstInclusiveCents(p.rates.twoHourCents))} to pay`}
              />
            </div>
          </section>

          {/* ---- Weekday deal ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">Weekday-daytime deal</h2>
            <p className="mb-5 text-sm text-text-muted">
              A cheaper 2-hour rate for sessions that finish inside a weekday
              window. Switch it off and it disappears everywhere at once — the
              option card, the price rows, the FAQ, the availability flag.
            </p>
            <Toggle name="deal_enabled" defaultChecked={p.weekdayDeal.enabled}>
              Offer the weekday-daytime rate
            </Toggle>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MoneyField
                label="2 hours (deal)"
                name="deal_price"
                cents={p.weekdayDeal.twoHourPriceCents}
                hint={`${formatNZD(gstInclusiveCents(p.weekdayDeal.twoHourPriceCents))} to pay`}
              />
              <Field label="Window opens (hour)" name="deal_start">
                <input
                  id="deal_start"
                  name="deal_start"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={p.weekdayDeal.windowStartHour}
                  className="input mt-2"
                />
                <Hint>{formatHour(p.weekdayDeal.windowStartHour)}</Hint>
              </Field>
              <Field label="Session must end by" name="deal_end">
                <input
                  id="deal_end"
                  name="deal_end"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={p.weekdayDeal.windowEndHour}
                  className="input mt-2"
                />
                <Hint>
                  {formatHour(p.weekdayDeal.windowEndHour)} · latest start{" "}
                  {formatHour(p.weekdayDeal.windowEndHour - 2)}
                </Hint>
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
              <Field label="Deal name (shown to customers)" name="deal_label">
                <input
                  id="deal_label"
                  name="deal_label"
                  defaultValue={p.weekdayDeal.label}
                  className="input mt-2"
                />
              </Field>
              <Field label="Short note" name="deal_short_note">
                <input
                  id="deal_short_note"
                  name="deal_short_note"
                  defaultValue={p.weekdayDeal.shortNote}
                  placeholder="(no sub)"
                  className="input mt-2"
                />
              </Field>
            </div>
          </section>

          {/* ---- Pack ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">Prepaid pack</h2>
            <p className="mb-5 text-sm text-text-muted">
              Prepaid hours banked to the customer&apos;s account. They book the
              first session online; the rest are drawn down later. Switching it off
              only stops new sales — hours already banked stay bookable.
            </p>
            <Toggle name="pack_enabled" defaultChecked={p.pack.enabled}>
              Sell the pack online
            </Toggle>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Hours in the pack" name="pack_hours">
                <input
                  id="pack_hours"
                  name="pack_hours"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={p.pack.packHours}
                  className="input mt-2"
                />
              </Field>
              <MoneyField
                label="Pack price"
                name="pack_total"
                cents={p.pack.totalCents}
                hint={`${formatNZD(packHourlyCents(p))}/hr · ${formatNZD(gstInclusiveCents(p.pack.totalCents))} to pay`}
              />
              <Field label="First session (hours)" name="pack_first_hours">
                <select
                  id="pack_first_hours"
                  name="pack_first_hours"
                  defaultValue={String(p.pack.firstSessionHours)}
                  className="input mt-2"
                >
                  <option value="1">1 hour booked now</option>
                  <option value="2">2 hours booked now</option>
                </select>
                <Hint>{p.pack.packHours - p.pack.firstSessionHours}h banked after booking</Hint>
              </Field>
            </div>
          </section>

          {/* ---- Group surcharge ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">Group surcharge</h2>
            <p className="mb-5 text-sm text-text-muted">
              A flat amount on top for bigger groups, added automatically at
              booking. Applies to groups <em>above</em> the threshold. Set both
              amounts to 0 to stop charging it.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Applies above" name="surcharge_threshold">
                <input
                  id="surcharge_threshold"
                  name="surcharge_threshold"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={p.groupSurcharge.threshold}
                  className="input mt-2"
                />
                <Hint>
                  {p.groupSurcharge.threshold + 1}–{p.room.maxGroupSize} people pay it
                </Hint>
              </Field>
              <MoneyField
                label="On a 1-hour booking"
                name="surcharge_1h"
                cents={p.groupSurcharge.oneHourCents}
              />
              <MoneyField
                label="On a 2-hour booking"
                name="surcharge_2h"
                cents={p.groupSurcharge.twoHourCents}
              />
            </div>
          </section>

          {/* ---- Option cards ---- */}
          <section className="card p-6">
            <h2 className="eyebrow mb-1">Booking options</h2>
            <p className="mb-5 text-sm text-text-muted">
              The cards someone picks from on step 2, in order. Switch one off to
              take it out of the flow without losing its price. Banked-hours
              options aren&apos;t here — they appear on their own for customers who
              have hours to spend.
            </p>
            <div className="space-y-4">
              {optionIds.map((id) => (
                <div key={id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                  <Toggle name={`opt_${id}_enabled`} defaultChecked={p.options[id].enabled}>
                    <span className="mono text-text">{optionPriceLabel(id, p.options[id].label)}</span>
                  </Toggle>
                  <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,240px)_1fr]">
                    <Field label="Card title" name={`opt_${id}_label`}>
                      <input
                        id={`opt_${id}_label`}
                        name={`opt_${id}_label`}
                        defaultValue={p.options[id].label}
                        className="input mt-2"
                      />
                    </Field>
                    <Field label="One-line description" name={`opt_${id}_note`}>
                      <input
                        id={`opt_${id}_note`}
                        name={`opt_${id}_note`}
                        defaultValue={p.options[id].note}
                        className="input mt-2"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton busyLabel="Saving…" className="btn btn-primary">
              Save prices
            </SubmitButton>
            <p className="font-mono text-[11px] uppercase tracking-meta text-text-dim">
              {updatedAt ? `Last changed ${formatNZ(updatedAt, "d MMM yyyy, h:mmaaa")}` : "Never changed"}
            </p>
          </div>
        </form>

        {/* ---- What the customer sees ---- */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="card p-6">
            <h2 className="eyebrow mb-4">What customers see</h2>
            {options.length === 0 ? (
              <p className="text-sm text-danger">
                Every option is switched off — nobody can book online right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {options.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block text-sm text-text">{o.label}</span>
                      <span className="block font-mono text-[11px] uppercase tracking-meta text-text-dim">
                        {o.durationHours}h · {o.note}
                      </span>
                    </span>
                    <span className="mono shrink-0 text-sm text-accent">
                      {formatNZDPlusGst(o.baseCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="eyebrow mb-4">Worked examples</h2>
            <dl className="space-y-3">
              <Example
                label="1 hour, 2 people"
                value={formatNZDPlusGstIncl(
                  calcBookingPriceCents({ settings: p, optionId: "1h", groupSize: 2 }).totalCents,
                )}
              />
              <Example
                label="2 hours, 2 people"
                value={formatNZDPlusGstIncl(
                  calcBookingPriceCents({ settings: p, optionId: "2h", groupSize: 2 }).totalCents,
                )}
              />
              <Example
                label={`2 hours, ${p.groupSurcharge.threshold + 1} people`}
                value={formatNZDPlusGstIncl(
                  calcBookingPriceCents({
                    settings: p,
                    optionId: "2h",
                    groupSize: p.groupSurcharge.threshold + 1,
                  }).totalCents,
                )}
              />
              {p.weekdayDeal.enabled ? (
                <Example
                  label={`2 hours, weekday ${formatHour(p.weekdayDeal.windowStartHour)} start`}
                  value={formatNZDPlusGstIncl(p.weekdayDeal.twoHourPriceCents)}
                />
              ) : null}
              {p.pack.enabled ? (
                <Example
                  label={`${p.pack.packHours}-hour pack`}
                  value={formatNZDPlusGstIncl(p.pack.totalCents)}
                />
              ) : null}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="eyebrow mb-2">Start again</h2>
            <p className="mb-4 text-sm text-text-muted">
              Puts every field back to the built-in defaults: flat{" "}
              {formatNZDPlusGst(5000)} an hour, weekday deal and pack on.
            </p>
            <form action={resetPricing}>
              <SubmitButton
                busyLabel="Resetting…"
                confirm="Reset every price to the built-in defaults? This takes effect on the live site straight away."
                className="btn btn-secondary w-full"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset to defaults
              </SubmitButton>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );

  function optionPriceLabel(id: BookingOptionId, label: string): string {
    const cents =
      id === "1h"
        ? p.rates.oneHourCents
        : id === "2h"
          ? p.rates.twoHourCents
          : id === "2h-daytime"
            ? p.weekdayDeal.twoHourPriceCents
            : p.pack.totalCents;
    return `${label} — ${formatNZDPlusGst(cents)}`;
  }
}

function Field({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="font-mono text-meta uppercase tracking-meta text-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function MoneyField({
  label,
  name,
  cents,
  hint,
}: {
  label: string;
  name: string;
  cents: number;
  hint?: string;
}) {
  return (
    <Field label={`${label} ($ ex-GST)`} name={name}>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        defaultValue={(cents / 100).toFixed(2)}
        className="input mt-2"
        required
      />
      {hint ? <Hint>{hint}</Hint> : null}
    </Field>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 font-mono text-[11px] uppercase tracking-meta text-text-dim">{children}</p>
  );
}

function Toggle({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-text-muted">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--color-accent)]"
      />
      {children}
    </label>
  );
}

function Example({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="font-mono text-[11px] uppercase tracking-meta text-text-muted">{label}</dt>
      <dd className="mono shrink-0 text-sm text-text">{value}</dd>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "bad" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-accent/40 bg-accent/10 text-accent"
      : tone === "bad"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border bg-bg-elev text-text-muted";
  return (
    <div role="status" className={`mt-6 flex items-start gap-3 rounded-sm border px-4 py-3 text-sm ${cls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
