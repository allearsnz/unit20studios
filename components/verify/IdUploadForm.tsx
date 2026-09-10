"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type DocType = "drivers_licence" | "passport";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

export function IdUploadForm({
  token,
  resubmitting = false,
  onSubmitted,
  onTokenDead,
}: {
  token: string;
  resubmitting?: boolean;
  /** Told when the upload lands. A parent that passes this owns the "thanks"
   *  message — the built-in card below would be a second one saying the same
   *  thing in a different box. */
  onSubmitted?: () => void;
  /** Told when the server says this token is gone — replaced by a newer one, or
   *  expired. Only the confirmation page can do anything about that (it knows
   *  the booking reference, so it can ask for a fresh link), and without it the
   *  customer is left retrying a form that can never succeed. A parent that
   *  passes this owns the message; without one we fall back to telling them
   *  plainly rather than saying "please try again" about something that won't
   *  work the second time either. */
  onTokenDead?: () => void;
}) {
  const [docType, setDocType] = useState<DocType>("drivers_licence");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // A passport photo page is one side; a licence has two.
  const backRequired = docType === "drivers_licence";
  const canSubmit = !!front && (!backRequired || !!back) && !busy;

  const submit = async () => {
    if (!front) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("docType", docType);
      body.set("front", front);
      if (back) body.set("back", back);

      const res = await fetch(`/api/verify-id/${encodeURIComponent(token)}`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 404 is the one error retrying can't fix: this token has been
        // replaced or has expired, so every further attempt from this page
        // fails the same way. Hand it up instead of inviting another go.
        if (res.status === 404 && onTokenDead) {
          onTokenDead();
          setBusy(false);
          return;
        }
        setError(data.error || "Something went wrong. Please try again.");
        setBusy(false);
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setDone(true);
      onSubmitted?.();
    } catch {
      setError("Couldn't reach the studio. Check your connection and try again.");
    }
    setBusy(false);
  };

  if (done && onSubmitted) return null;

  if (done) {
    return (
      <div className="card mt-10 flex items-start gap-4 p-7">
        <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="font-display text-h3 font-semibold text-text">
            Sent — thanks.
          </h2>
          <p className="lead mt-2 text-sm">
            We&apos;ll check it and email you once your booking is confirmed.
            You can close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mt-10">
      {error ? (
        <div
          role="alert"
          className="mb-6 border border-danger/40 bg-danger/10 px-5 py-4 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <fieldset>
        <legend className="font-mono text-meta uppercase tracking-meta text-text-muted">
          What are you sending?
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["drivers_licence", "Driver licence", "Front and back"],
              ["passport", "Passport", "Photo page"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDocType(value)}
              aria-pressed={docType === value}
              className={cn(
                "card p-5 text-left transition-colors",
                docType === value ? "border-accent" : "card-hover",
              )}
            >
              <span className="block font-display text-h3 font-semibold text-text">
                {label}
              </span>
              <span className="mt-1 block font-mono text-meta uppercase tracking-meta text-text-muted">
                {hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 space-y-4">
        <FilePicker
          label={docType === "passport" ? "Photo page" : "Front"}
          file={front}
          onPick={setFront}
        />
        <FilePicker
          label={docType === "passport" ? "Second page (optional)" : "Back"}
          file={back}
          onPick={setBack}
          optional={!backRequired}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="btn btn-primary mt-8 w-full sm:w-auto"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          <>{resubmitting ? "Send the new one" : "Send to the studio"}</>
        )}
      </button>
    </div>
  );
}

function FilePicker({
  label,
  file,
  onPick,
  optional = false,
}: {
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
  optional?: boolean;
}) {
  const id = `id-doc-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          // The real input is sr-only, so :focus-visible would land on a clipped
          // 1px box — keyboard users would see nothing. Mirror it onto the label.
          "card card-hover flex cursor-pointer items-center gap-4 p-5",
          "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
          file && "border-accent",
        )}
      >
        {file ? (
          <Check className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        ) : (
          <Upload className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block font-mono text-meta uppercase tracking-meta text-text-muted">
            {label}
            {optional ? " · optional" : ""}
          </span>
          <span className="mt-0.5 block truncate text-sm text-text">
            {file ? file.name : "Choose a photo or PDF"}
          </span>
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
