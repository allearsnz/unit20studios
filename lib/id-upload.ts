/**
 * What counts as a usable ID document — the rules, in the one place both sides
 * can read them.
 *
 * This is deliberately free of `node:` imports and Supabase clients so the
 * upload form can use it directly. `lib/id-verification.ts` re-exports the
 * public half; the form imports it here. The alternative was the browser
 * guessing at limits the server actually enforces, which is how you get a
 * customer waiting forty seconds on a phone connection to be told the file was
 * too big all along.
 */

/** Accepted uploads. Phones shoot HEIC, scanners emit PDF — take both. */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Stored file extension for each accepted type. */
export const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** The other direction, for files the browser hands over unlabelled. */
const MIME_FOR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

/** Spellings that mean one of the accepted types but aren't it. */
const MIME_ALIAS: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
};

/** Types a browser uses to mean "I have no idea what this is". */
const UNKNOWN_MIME = new Set(["", "application/octet-stream", "binary/octet-stream"]);

/**
 * What the file actually is — because `File.type` is not to be trusted.
 *
 * This is the single most common way a perfectly good upload used to be turned
 * away. A phone photo of a licence arrives with an empty `type` often enough to
 * matter: Android's document picker and several in-app browsers hand over
 * `application/octet-stream` or nothing at all, and a `.heic` off a Windows
 * machine frequently has no registered type either. Judging solely on what the
 * browser declared meant telling those people their licence "isn't a supported
 * type" — an error that is both wrong and unfixable from their end, and which
 * reached the server logs as nothing but a 422.
 *
 * So: take the declaration when it's one we accept, normalise the known
 * misspellings, and when it's blank or generic fall back to the file extension.
 * Anything still unidentified is genuinely refused. On the server the answer is
 * used for the type check, the storage `contentType` *and* the stored path's
 * extension, so the bucket's own `allowed_mime_types` can never disagree with
 * it.
 */
export function resolveUploadMime(file: { type?: string; name?: string }): string | null {
  const declared = (file.type ?? "").toLowerCase().split(";")[0].trim();
  const normalised = MIME_ALIAS[declared] ?? declared;
  if ((ACCEPTED_MIME as readonly string[]).includes(normalised)) return normalised;

  if (UNKNOWN_MIME.has(normalised)) {
    const ext = (file.name ?? "").toLowerCase().split(".").pop() ?? "";
    return MIME_FOR_EXTENSION[ext] ?? null;
  }
  return null;
}

/**
 * The `accept` attribute, MIME types *and* extensions.
 *
 * The extensions are not redundant. A picker that filters on the registered
 * type will hide a `.heic` on any machine that doesn't have one registered —
 * which is most Windows machines — and the customer is left staring at a file
 * browser that claims their photo isn't there.
 */
export const ACCEPT_ATTR = [...ACCEPTED_MIME, ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"].join(",");
