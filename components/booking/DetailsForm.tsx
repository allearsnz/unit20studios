"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { DetailsValues } from "./types";

const today = new Date().toISOString().slice(0, 10);

function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={htmlFor}
          className="font-mono text-meta uppercase tracking-meta text-text-muted"
        >
          {label}
        </label>
        {hint ? <span className="text-xs text-text-dim">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DetailsForm({
  register,
  errors,
}: {
  register: UseFormRegister<DetailsValues>;
  errors: FieldErrors<DetailsValues>;
}) {
  return (
    <div className="grid gap-7 sm:grid-cols-2">
      <Field label="Name" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          {...register("name")}
          className="input"
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          {...register("email")}
          className="input"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
        />
      </Field>

      <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
        <input
          id="phone"
          type="tel"
          {...register("phone")}
          className="input"
          autoComplete="tel"
          placeholder="021 123 4567"
          aria-invalid={errors.phone ? true : undefined}
        />
      </Field>

      <Field label="Date of birth" htmlFor="dob" hint="16+ only" error={errors.dob?.message}>
        <input
          id="dob"
          type="date"
          max={today}
          {...register("dob")}
          className="input [color-scheme:dark]"
          aria-invalid={errors.dob ? true : undefined}
        />
      </Field>

      <Field
        label="What are you working on?"
        htmlFor="note"
        hint="Optional"
        error={errors.customerNote?.message}
        className="sm:col-span-2"
      >
        <textarea
          id="note"
          rows={3}
          {...register("customerNote")}
          className="input resize-none"
          placeholder="Practising a set, recording a mix, teaching a mate…"
        />
      </Field>
    </div>
  );
}
