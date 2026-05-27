"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const ds = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Civil-date month picker (TZ-independent). `min`/`max`/`value` are YYYY-MM-DD. */
export function Calendar({
  value,
  min,
  max,
  onChange,
}: {
  value: string | null;
  min: string;
  max: string;
  onChange: (date: string) => void;
}) {
  const init = value ?? min;
  const [vy, setVy] = useState(Number(init.slice(0, 4)));
  const [vm, setVm] = useState(Number(init.slice(5, 7)) - 1);

  const firstDow = (new Date(Date.UTC(vy, vm, 1)).getUTCDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(Date.UTC(vy, vm + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const atMin = vy === Number(min.slice(0, 4)) && vm === Number(min.slice(5, 7)) - 1;
  const atMax = vy === Number(max.slice(0, 4)) && vm === Number(max.slice(5, 7)) - 1;

  const go = (delta: number) => {
    let m = vm + delta;
    let y = vy;
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    setVm(m);
    setVy(y);
  };

  return (
    <div className="max-w-sm">
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={atMin}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center border border-border text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-sm uppercase tracking-meta text-text">
          {MONTHS[vm]} {vy}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={atMax}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center border border-border text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:text-text-dim/40 disabled:hover:border-border"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center font-mono text-meta uppercase tracking-meta text-text-dim">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const date = ds(vy, vm, d);
          const disabled = date < min || date > max;
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={date}
              onClick={() => onChange(date)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm border text-sm transition-colors",
                disabled && "cursor-not-allowed border-transparent text-text-dim/30",
                !disabled &&
                  !selected &&
                  "border-border text-text hover:border-accent hover:text-accent",
                selected && "border-accent bg-accent font-medium text-bg",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
