import { createElement } from "react";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import IdVerificationRequest from "@/emails/IdVerificationRequest";
import { sendEmail } from "./email";
import { createAdminClient } from "./supabase/admin";
import { ON_PAGE_GRACE_MS } from "./id-handoff";
import { EXTENSION } from "./id-upload";
import { site } from "./site";
import type { Customer, IdVerification } from "./types";

/**
 * Remote ID checks. An unverified customer gets a one-off link after booking,
 * uploads the front and back of a licence or passport, and the admin approves
 * it from the booking or customer panel.
 *
 * `customers.id_verified` stays the source of truth — this module only handles
 * getting the images in front of the admin, then getting rid of them again.
 */

export const ID_BUCKET = "id-documents";

/** How long an upload link stays live. Longer than any booking lead time is
 *  pointless; short enough that an old inbox isn't a standing liability. */
const LINK_TTL_DAYS = 30;

// The rules about the files themselves live in `lib/id-upload.ts`, which has no
// server-only imports, so the upload form can hold the browser to exactly the
// same limits this route enforces. Re-exported here because this is where every
// server caller already looks.
export { ACCEPTED_MIME, MAX_UPLOAD_BYTES, resolveUploadMime } from "./id-upload";

/**
 * How long a minted-but-unsent link sits before the server posts one itself.
 *
 * Deliberately far longer than `ON_PAGE_GRACE_MS`, and the gap is the point.
 * The two used to be the same five minutes, which meant the confirmation page's
 * own timer and `sweepUnsentIdLinks` came due at the same instant — and because
 * the sweep can only ever *rotate* (it holds the hash, never the token, so it
 * has no other way to produce a link it can send), whichever won killed the
 * form the customer was in the middle of filling in. Anyone who took longer
 * than five minutes to photograph their licence — which is most people — could
 * end up submitting against a token that had been replaced underneath them,
 * getting "that link isn't valid any more" on every attempt, on a page that
 * looked perfectly fine, for as long as they kept trying.
 *
 * So the browser gets a clear run at asking for its own email, and this is the
 * net for the case where it never asked at all. Half an hour is still a
 * fraction of the cleanup cron's warn-then-release ladder, so nobody's slot is
 * any closer to being let go than it was.
 *
 * Expressed as a multiple of the grace period on purpose: whatever anyone tunes
 * that to, the sweep stays strictly behind it rather than drifting back into a
 * tie.
 */
export const SWEEP_AFTER_MS = 6 * ON_PAGE_GRACE_MS; // 30 minutes

export type DocType = "drivers_licence" | "passport";

/** The token lives in the customer's inbox; only its hash is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyIdUrl(token: string): string {
  return `${site.url}/verify-id/${token}`;
}

type CustomerLite = Pick<Customer, "id" | "name" | "email" | "id_verified">;

const CUSTOMER_FIELDS = "id, name, email, id_verified";

export type RequestResult =
  | { status: "sent"; email: string }
  | {
      status: "skipped";
      reason: "already_verified" | "already_submitted" | "customer_not_found" | "no_email";
    }
  | { status: "failed"; reason: string };

/**
 * Mint a fresh token onto the customer's row, retiring whatever was there.
 *
 * IT ROTATES THE TOKEN AND NOTHING ELSE. It used to also delete the stored
 * images and blank `submitted_at`, on the reasoning that a new link means a new
 * submission — and that was the bug behind "I sent my ID days ago and they keep
 * asking for it". Three ordinary events rotate a token: the customer books a
 * second session, the nightly cleanup chases an unconfirmed booking, an admin
 * resends. Every one of them silently destroyed a licence scan that was sitting
 * there waiting to be approved, and left the admin panel reading "nothing
 * uploaded yet" about someone who had done exactly what was asked.
 *
 * Nothing needed it. A *new* upload supersedes the old one in the upload route,
 * which deletes the images it replaces, and approval deletes them too — so the
 * two moments that should clear a submission both already do, and neither is
 * this one. Clearing it here only ever threw away the good copy.
 *
 * `sent_at` still resets, because that is the token's own bookkeeping: it means
 * "an email carrying *this* link has left", which a rotation makes false again,
 * and `sweepUnsentIdLinks` reads it to find people who were issued a link and
 * never got one.
 */
async function rotateToken(
  supabase: SupabaseClient,
  customerId: string,
): Promise<{ token: string } | { error: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 3600 * 1000).toISOString();

  const { error } = await supabase.from("id_verifications").upsert(
    {
      customer_id: customerId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      sent_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );
  if (error) return { error: error.message };
  return { token };
}

/**
 * Has this customer already sent their documents in and had no answer yet?
 *
 * The guard in front of every rotation that isn't an operator explicitly asking
 * for a new photo. "Unverified" and "hasn't uploaded" are different states, and
 * conflating them is what let the cron chase — and eventually release the slot
 * of — someone whose licence was sitting in the admin panel the whole time.
 */
async function pendingSubmission(
  supabase: SupabaseClient,
  customerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("id_verifications")
    .select("submitted_at")
    .eq("customer_id", customerId)
    .maybeSingle();
  return !!(data as Pick<IdVerification, "submitted_at"> | null)?.submitted_at;
}

/** Email one specific token and stamp the send. Callers own the token's life. */
async function emailToken(
  supabase: SupabaseClient,
  customer: Pick<Customer, "id" | "name" | "email">,
  token: string,
): Promise<RequestResult> {
  const sent = await sendEmail({
    to: customer.email,
    subject: "One quick thing — verify your ID for Unit 20",
    react: createElement(IdVerificationRequest, {
      firstName: customer.name.split(/\s+/)[0] || "there",
      verifyUrl: verifyIdUrl(token),
      expiryDays: LINK_TTL_DAYS,
    }),
  });
  if (!sent.ok) return { status: "failed", reason: sent.error ?? "send_failed" };

  // Stamped only on a send that actually went. A failed send leaves the row
  // looking exactly like an unsent one, which is correct: the sweep will try
  // again rather than counting a bounce as delivery.
  const { data: row } = await supabase
    .from("id_verifications")
    .select("send_count")
    .eq("customer_id", customer.id)
    .maybeSingle();
  await supabase
    .from("id_verifications")
    .update({
      sent_at: new Date().toISOString(),
      send_count: ((row as { send_count: number } | null)?.send_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("customer_id", customer.id);

  return { status: "sent", email: customer.email };
}

async function loadCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<CustomerLite | null> {
  const { data } = await supabase
    .from("customers")
    .select(CUSTOMER_FIELDS)
    .eq("id", customerId)
    .maybeSingle();
  return (data as CustomerLite | null) ?? null;
}

/**
 * Create (or rotate) a customer's upload link and email it *now*. Rotating in
 * place kills the previous link — a resend must not leave two working ways in.
 *
 * This is the admin/crew/cron path: nobody is sitting in front of a page, so
 * the email is the only way in and it goes immediately. The booking flow uses
 * `createIdVerificationLink` instead.
 *
 * Never throws: an email problem must not cost someone their slot.
 *
 * `force` is the difference between a machine chasing someone and an operator
 * asking for a new photo. Unforced, this will not touch a customer who has
 * already uploaded and is waiting on a decision — chasing them is wrong, and
 * before the guard existed it also retired the link their still-open page was
 * using. Forced, it does what the admin pressed the button for: the old scan
 * was blurry, the wrong document, or the wrong person, and they want another.
 */
export async function requestIdVerification(
  customerId: string,
  { force = false }: { force?: boolean } = {},
): Promise<RequestResult> {
  try {
    const supabase = createAdminClient();
    const customer = await loadCustomer(supabase, customerId);

    if (!customer) return { status: "skipped", reason: "customer_not_found" };
    if (customer.id_verified) return { status: "skipped", reason: "already_verified" };
    if (!customer.email) return { status: "skipped", reason: "no_email" };
    if (!force && (await pendingSubmission(supabase, customerId))) {
      return { status: "skipped", reason: "already_submitted" };
    }

    const minted = await rotateToken(supabase, customerId);
    if ("error" in minted) return { status: "failed", reason: minted.error };

    return await emailToken(supabase, customer, minted.token);
  } catch (err) {
    console.error("[id-verification] request failed", { customerId, err });
    return { status: "failed", reason: err instanceof Error ? err.message : "unknown" };
  }
}

export type CreateLinkResult =
  | { status: "ready"; token: string }
  | {
      status: "skipped";
      reason: "already_verified" | "already_submitted" | "customer_not_found" | "no_email";
    }
  | { status: "failed"; reason: string };

/**
 * Mint the link and hand it straight back to the caller instead of emailing it.
 *
 * Used by booking creation: the token goes to the browser that just booked, the
 * confirmation page puts the upload form in front of them, and the email is
 * held back for `ON_PAGE_GRACE_MS`. Nothing is lost if they never come back —
 * the row exists, unsent, and the sweep picks it up.
 *
 * Never throws, for the same reason `requestIdVerification` doesn't.
 */
export async function createIdVerificationLink(customerId: string): Promise<CreateLinkResult> {
  try {
    const supabase = createAdminClient();
    const customer = await loadCustomer(supabase, customerId);

    if (!customer) return { status: "skipped", reason: "customer_not_found" };
    if (customer.id_verified) return { status: "skipped", reason: "already_verified" };
    // No email address means the sweep can never rescue them, so refuse to mint
    // a link that only exists on one page — the admin gets the usual "no link
    // has gone out" flag instead.
    if (!customer.email) return { status: "skipped", reason: "no_email" };
    // Already sent their documents in and waiting on us. This fires on a second
    // booking made before the first was approved: there is nothing for them to
    // upload, and minting a link would put a form in front of someone who has
    // finished. The confirmation page reads the same row and says "we've got
    // your ID" instead.
    if (await pendingSubmission(supabase, customerId)) {
      return { status: "skipped", reason: "already_submitted" };
    }

    const minted = await rotateToken(supabase, customerId);
    if ("error" in minted) return { status: "failed", reason: minted.error };

    return { status: "ready", token: minted.token };
  } catch (err) {
    console.error("[id-verification] create link failed", { customerId, err });
    return { status: "failed", reason: err instanceof Error ? err.message : "unknown" };
  }
}

export type SendExistingResult =
  | { status: "sent"; email: string }
  | { status: "skipped"; reason: "already_sent" | "already_submitted" | "already_verified" | "no_email" }
  | { status: "failed"; reason: "not_found" | "expired" | string };

/**
 * Email a link the customer is already holding, without rotating it.
 *
 * This is what the confirmation page calls when its five minutes are up or the
 * customer closes the tab. NOT rotating is the whole point: someone who wanders
 * back to that still-open page half an hour later must not find the form dead
 * because we posted them a different token in the meantime.
 */
export async function sendIdVerificationLink(token: string): Promise<SendExistingResult> {
  try {
    const lookup = await verificationByToken(token);
    if (!lookup.ok) return { status: "failed", reason: lookup.reason };
    if (lookup.verification.submitted_at) return { status: "skipped", reason: "already_submitted" };
    if (lookup.verification.sent_at) return { status: "skipped", reason: "already_sent" };

    const supabase = createAdminClient();
    const customer = await loadCustomer(supabase, lookup.customer.id);
    if (!customer) return { status: "failed", reason: "not_found" };
    if (customer.id_verified) return { status: "skipped", reason: "already_verified" };
    if (!customer.email) return { status: "skipped", reason: "no_email" };

    const result = await emailToken(supabase, customer, token);
    return result.status === "sent"
      ? { status: "sent", email: result.email }
      : { status: "failed", reason: result.status === "failed" ? result.reason : "send_failed" };
  } catch (err) {
    console.error("[id-verification] send existing link failed", { err });
    return { status: "failed", reason: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * The safety net: anyone issued a link who never used it and never got an
 * email.
 *
 * The browser is meant to ask for the email itself (a timer, and a beacon when
 * the tab goes), but a browser is not a guarantee — tabs get killed, JS gets
 * blocked, phones fall asleep mid-upload. This runs off the back of ordinary
 * traffic and the nightly cleanup, and it is the thing that means "we never
 * sent them a link" can't happen twice.
 *
 * Rotates before sending, unlike `sendIdVerificationLink` — it only ever holds
 * the hash, so there is no existing token for it to put in an email. That is
 * exactly why it waits `SWEEP_AFTER_MS` rather than `ON_PAGE_GRACE_MS`: a
 * rotation lands on whoever is still holding that page, and at five minutes
 * somebody usually is.
 */
export async function sweepUnsentIdLinks(limit = 25): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  try {
    const supabase = createAdminClient();
    const cutoff = new Date(Date.now() - SWEEP_AFTER_MS).toISOString();

    const { data } = await supabase
      .from("id_verifications")
      .select("customer_id, customer:customers(id, id_verified)")
      .is("sent_at", null)
      .is("submitted_at", null)
      .lt("updated_at", cutoff)
      .limit(limit);

    type Row = { customer_id: string; customer: { id_verified: boolean } | { id_verified: boolean }[] | null };
    for (const row of (data as Row[] | null) ?? []) {
      const c = Array.isArray(row.customer) ? row.customer[0] : row.customer;
      // Verified in the meantime — Will cleared them in person while they were
      // still on the page. Nothing to chase.
      if (!c || c.id_verified) continue;
      const res = await requestIdVerification(row.customer_id);
      if (res.status === "sent") sent += 1;
      else if (res.status === "failed") failed += 1;
    }
  } catch (err) {
    console.error("[id-verification] sweep failed", { err });
  }
  if (sent || failed) console.info("[id-verification] swept unsent links", { sent, failed });
  return { sent, failed };
}

export type TokenLookup =
  | { ok: true; verification: IdVerification; customer: Pick<Customer, "id" | "name"> }
  | { ok: false; reason: "not_found" | "expired" };

/** Resolve an emailed token. Expiry is checked here, not in the query, so an
 *  expired link can say so rather than looking like a broken URL. */
export async function verificationByToken(token: string): Promise<TokenLookup> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("id_verifications")
    .select("*, customer:customers(id, name)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  const row = data as (IdVerification & { customer: Pick<Customer, "id" | "name"> | null }) | null;
  if (!row || !row.customer) return { ok: false, reason: "not_found" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  return { ok: true, verification: row, customer: row.customer };
}

/** Storage key for one side of a customer's document. */
export function documentPath(customerId: string, side: "front" | "back", mime: string): string {
  const ext = EXTENSION[mime] ?? "bin";
  // The timestamp keeps a re-upload from being cached behind the old signed URL.
  return `${customerId}/${side}-${Date.now()}.${ext}`;
}

/** Short-lived signed URLs for the admin panel — the bucket is private, so
 *  these are the only way to see an image, and they die in five minutes. */
export async function signedDocumentUrls(
  supabase: SupabaseClient,
  verification: Pick<IdVerification, "front_path" | "back_path">,
): Promise<{ front: string | null; back: string | null }> {
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data } = await supabase.storage.from(ID_BUCKET).createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  };
  const [front, back] = await Promise.all([sign(verification.front_path), sign(verification.back_path)]);
  return { front, back };
}

/** Drop the images from storage. Best-effort — a storage hiccup must not stop
 *  an admin verifying someone. */
export async function removeStoredDocuments(
  supabase: SupabaseClient,
  verification: Pick<IdVerification, "front_path" | "back_path">,
): Promise<void> {
  const paths = [verification.front_path, verification.back_path].filter(
    (p): p is string => !!p,
  );
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(ID_BUCKET).remove(paths);
  } catch (err) {
    console.error("[id-verification] document cleanup failed", { err });
  }
}

export type VerificationView = {
  state: "verified" | "submitted" | "awaiting" | "none";
  verification: IdVerification | null;
  front: string | null;
  back: string | null;
};

/**
 * Everything the admin panel needs for one customer, in one call. Signed URLs
 * are only minted when there's something to look at.
 *
 * `prefetched` exists because the booking page needs this same `id_verifications`
 * row for its automation checklist too, and the two were fetching it separately
 * — a whole extra Tokyo round trip for a row already in memory. Pass the row in
 * and this makes no query at all. `undefined` means "go and fetch it"; `null`
 * means "I looked and there isn't one".
 */
export async function verificationView(
  supabase: SupabaseClient,
  customer: Pick<Customer, "id" | "id_verified">,
  prefetched?: IdVerification | null,
): Promise<VerificationView> {
  let verification: IdVerification | null;
  if (prefetched !== undefined) {
    verification = prefetched;
  } else {
    const { data } = await supabase
      .from("id_verifications")
      .select("*")
      .eq("customer_id", customer.id)
      .maybeSingle();
    verification = (data as IdVerification | null) ?? null;
  }

  if (customer.id_verified) {
    return { state: "verified", verification, front: null, back: null };
  }
  if (verification?.submitted_at) {
    const { front, back } = await signedDocumentUrls(supabase, verification);
    return { state: "submitted", verification, front, back };
  }
  return {
    state: verification ? "awaiting" : "none",
    verification,
    front: null,
    back: null,
  };
}
