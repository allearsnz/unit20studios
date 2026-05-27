"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { CONTACT_SUBJECTS, contactFormSchema, type ContactFormValues } from "@/lib/validation";

export function ContactForm({
  defaultSubject,
  defaultMessage,
}: {
  defaultSubject?: string;
  defaultMessage?: string;
}) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const subject = (CONTACT_SUBJECTS as readonly string[]).includes(defaultSubject ?? "")
    ? (defaultSubject as (typeof CONTACT_SUBJECTS)[number])
    : "Other";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { subject, message: defaultMessage ?? "", company: "" },
  });

  useEffect(() => {
    setValue("sourcePage", window.location.pathname + window.location.search);
  }, [setValue]);

  const onSubmit = async (data: ContactFormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(json.error || "Something went wrong — please try again.");
        return;
      }
      (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.("track", "Lead");
      setDone(true);
    } catch {
      setServerError("Network error — please check your connection and try again.");
    }
  };

  if (done) {
    return (
      <div className="card flex flex-col items-start gap-4 p-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent text-accent">
          <Check className="h-5 w-5" />
        </span>
        <h2 className="h3 text-text">Message sent.</h2>
        <p className="lead">
          Cheers — we&apos;ll get back to you shortly, usually within a day. Keep
          an eye on your inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-7">
      <div aria-live="polite">
        {serverError ? (
          <div role="alert" className="border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {serverError}
          </div>
        ) : null}
      </div>

      {/* honeypot */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label>
          Company
          <input type="text" tabIndex={-1} autoComplete="off" {...register("company")} />
        </label>
      </div>
      <input type="hidden" {...register("sourcePage")} />

      <div className="grid gap-7 sm:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          <input {...register("name")} className="input" autoComplete="name" aria-invalid={errors.name ? true : undefined} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...register("email")} className="input" autoComplete="email" aria-invalid={errors.email ? true : undefined} />
        </Field>
        <Field label="Phone (optional)" error={errors.phone?.message}>
          <input type="tel" {...register("phone")} className="input" autoComplete="tel" />
        </Field>
        <Field label="About" error={errors.subject?.message}>
          <select {...register("subject")} className="input [color-scheme:dark]">
            {CONTACT_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" error={errors.message?.message}>
        <textarea
          rows={6}
          {...register("message")}
          className="input resize-none"
          aria-invalid={errors.message ? true : undefined}
        />
      </Field>

      <button type="submit" disabled={isSubmitting} className="btn btn-primary">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          <>
            Send message <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-mono text-meta uppercase tracking-meta text-text-muted">{label}</label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
