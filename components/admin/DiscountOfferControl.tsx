"use client";

import { useState, useTransition } from "react";
import { emailDiscountCode } from "@/app/admin/actions";
import { DISCOUNT_PRESETS } from "@/lib/discounts";
import { cn } from "@/lib/utils";

/**
 * Booking-detail control: pick a % (quick presets or type one) and email the
 * customer a single-use discount code that self-applies on their next booking.
 */
export function DiscountOfferControl({ bookingId }: { bookingId: string }) {
  const [percent, setPercent] = useState<number>(15);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = () =>
    start(async () => {
      setMsg(null);
      const res = await emailDiscountCode(bookingId, percent);
      if (res.ok) {
        setMsg({ ok: true, text: `Sent — code ${res.code} is on its way.` });
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });

  return (
    <div>
      <p className="mb-3 text-sm text-text-muted">
        Email this customer a single-use code for % off their next session. Auto-named,
        expires in 60 days, and applies itself when they book.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="discount-percent"
            className="font-mono text-[11px] uppercase tracking-meta text-text-muted"
          >
            % off
          </label>
          <input
            id="discount-percent"
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Math.max(1, Math.min(100, Number(e.target.value) || 0)))}
            className="input mt-2 w-24"
          />
        </div>
        <div className="flex gap-2 pb-0.5">
          {DISCOUNT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              className={cn(
                "h-10 rounded-sm border px-3 font-mono text-xs uppercase tracking-meta transition-colors",
                percent === p
                  ? "border-accent text-accent"
                  : "border-border text-text-muted hover:border-text hover:text-text",
              )}
            >
              {p}%
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={send}
          className="btn btn-primary h-10 px-4 font-mono text-xs uppercase tracking-meta"
        >
          {pending ? "Sending…" : "Email discount code"}
        </button>
      </div>

      {msg ? (
        <p
          className={cn(
            "mt-3 font-mono text-[11px] uppercase tracking-meta",
            msg.ok ? "text-accent" : "text-danger",
          )}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
