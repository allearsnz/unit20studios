"use client";

export type DiscountState = "idle" | "checking" | "valid" | "invalid";

/**
 * Discount-code input for the booking flow. Purely UX — the booking API
 * re-validates and applies the discount server-side. Shows live validation
 * feedback and the % once a code checks out.
 */
export function DiscountField({
  value,
  state,
  percent,
  onChange,
}: {
  value: string;
  state: DiscountState;
  percent: number | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-8 border-t border-border pt-6">
      <label
        htmlFor="discount-code"
        className="font-mono text-meta uppercase tracking-meta text-text-muted"
      >
        Discount code
      </label>
      <input
        id="discount-code"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
        spellCheck={false}
        placeholder="Got a code? Enter it here"
        className="input mt-2 uppercase"
      />
      {state === "checking" ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-meta text-text-muted">Checking…</p>
      ) : state === "valid" && percent ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-meta text-accent">
          {percent}% off applied
        </p>
      ) : state === "invalid" ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-meta text-danger">
          That code isn&apos;t valid — you can still book at the normal rate.
        </p>
      ) : null}
    </div>
  );
}
