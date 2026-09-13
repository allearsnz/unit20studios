"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES, resolveUploadMime } from "@/lib/id-upload";

type DocType = "drivers_licence" | "passport";

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

/**
 * Say no here, not after the upload.
 *
 * The server checks all of this anyway — it has to, nothing from a browser is
 * trustworthy — but a phone on mobile data can spend the better part of a
 * minute pushing an oversized photo up before the answer comes back, and an
 * error that arrives after a long wait reads as the thing being broken rather
 * than the file being wrong. Same rules, same module, so the two can't drift.
 */
/**
 * Shrink a phone photo before it goes anywhere near the network.
 *
 * A modern phone camera produces a 4–12MB image of a driver licence, and every
 * one of those megabytes is a way for this to fail: a long upload on mobile
 * data that looks like a hang, a pair of them in one request pushing at limits
 * nobody here controls, and a spinner the customer eventually gives up on. None
 * of it buys anything — the check is a human reading a name, a date and a face,
 * and 2200px on the long edge is far more than that needs.
 *
 * Entirely best-effort, and that is the important property. Anything that goes
 * wrong — a format the browser can't decode (Chrome still can't read HEIC), no
 * canvas, a blob that comes back bigger than what went in — returns the
 * original file and lets the server deal with it exactly as before. It can make
 * the upload smaller; it can never make it fail.
 */
const MAX_EDGE_PX = 2200;
/** Below this, re-encoding costs detail and saves nothing worth having. */
const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return file; // A PDF. Leave it alone.
  }
  if (file.size <= SHRINK_ABOVE_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "id";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function genericError(status: number): string {
  if (status === 413) {
    return `Those photos were too large to send. Try one side at a time, or take them at a lower resolution.`;
  }
  if (status === 429) return "Too many attempts just now — wait a minute and try again.";
  if (status >= 500) {
    return "Our end had a problem saving that. Try once more, and email studio@unit20.nz if it happens again.";
  }
  return "Something went wrong. Please try again.";
}

function localProblem(file: File, label: string): string | null {
  if (file.size === 0) return `That ${label} file came through empty — try picking it again.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That ${label} photo is ${(file.size / 1024 / 1024).toFixed(1)}MB — over the ${MAX_MB}MB limit. Take it again at a lower resolution, or crop it.`;
  }
  if (!resolveUploadMime(file)) {
    return `We can't read that ${label} file. Send a photo (JPG, PNG or HEIC) or a PDF.`;
  }
  return null;
}

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

  const pick = (side: "front" | "back", file: File | null) => {
    const set = side === "front" ? setFront : setBack;
    if (!file) {
      set(null);
      return;
    }
    const problem = localProblem(file, side);
    if (problem) {
      set(null);
      setError(problem);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    set(file);
  };

  const submit = async () => {
    if (!front) return;
    setBusy(true);
    setError(null);
    try {
      // Resized here rather than at pick time: the customer can swap a photo
      // twice before they're happy, and there's no reason to spend their phone's
      // battery on the ones they discard.
      const [frontFile, backFile] = await Promise.all([shrink(front), back ? shrink(back) : null]);

      const body = new FormData();
      body.set("docType", docType);
      body.set("front", frontFile);
      if (backFile) body.set("back", backFile);

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
        // `data.error` is missing whenever the response never reached our code
        // — a platform-level rejection answers in HTML, and "Something went
        // wrong" about it is a support ticket with nothing in it. Say which
        // kind of wrong, so the next thing they try might actually work.
        setError(data.error || genericError(res.status));
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
          onPick={(f) => pick("front", f)}
        />
        <FilePicker
          label={docType === "passport" ? "Second page (optional)" : "Back"}
          file={back}
          onPick={(f) => pick("back", f)}
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
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          // Clear the input, not the state. Without this a rejected file is
          // still the input's value, so choosing the very same photo again
          // fires no `change` event at all and the picker looks dead — the
          // File itself is held in state, which is what the label reads.
          e.target.value = "";
        }}
      />
    </div>
  );
}
