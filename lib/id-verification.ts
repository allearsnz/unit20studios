import { createElement } from "react";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import IdVerificationRequest from "@/emails/IdVerificationRequest";
import { sendEmail } from "./email";
import { createAdminClient } from "./supabase/admin";
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

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export type DocType = "drivers_licence" | "passport";

/** The token lives in the customer's inbox; only its hash is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyIdUrl(token: string): string {
  return `${site.url}/verify-id/${token}`;
}

export type RequestResult =
  | { status: "sent"; email: string }
  | { status: "skipped"; reason: "already_verified" | "customer_not_found" | "no_email" }
  | { status: "failed"; reason: string };

/**
 * Create (or rotate) a customer's upload link and email it. Rotating in place
 * kills the previous link — a resend must not leave two working ways in.
 *
 * Never throws: this runs off the back of booking creation and an email problem
 * must not cost someone their slot.
 */
export async function requestIdVerification(customerId: string): Promise<RequestResult> {
  try {
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("customers")
      .select("id, name, email, id_verified")
      .eq("id", customerId)
      .maybeSingle();
    const customer = data as Pick<Customer, "id" | "name" | "email" | "id_verified"> | null;

    if (!customer) return { status: "skipped", reason: "customer_not_found" };
    if (customer.id_verified) return { status: "skipped", reason: "already_verified" };
    if (!customer.email) return { status: "skipped", reason: "no_email" };

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 3600 * 1000).toISOString();

    // Rotate the token and clear any previous submission: whatever they upload
    // through the new link is what the admin should be looking at.
    const { data: existing } = await supabase
      .from("id_verifications")
      .select("id, send_count, front_path, back_path")
      .eq("customer_id", customerId)
      .maybeSingle();
    const prior = existing as Pick<
      IdVerification,
      "id" | "send_count" | "front_path" | "back_path"
    > | null;

    if (prior) await removeStoredDocuments(supabase, prior);

    const { error } = await supabase.from("id_verifications").upsert(
      {
        customer_id: customerId,
        token_hash: hashToken(token),
        expires_at: expiresAt,
        front_path: null,
        back_path: null,
        doc_type: null,
        submitted_at: null,
        sent_at: new Date().toISOString(),
        send_count: (prior?.send_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
    if (error) return { status: "failed", reason: error.message };

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

    return { status: "sent", email: customer.email };
  } catch (err) {
    console.error("[id-verification] request failed", { customerId, err });
    return { status: "failed", reason: err instanceof Error ? err.message : "unknown" };
  }
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
 */
export async function verificationView(
  supabase: SupabaseClient,
  customer: Pick<Customer, "id" | "id_verified">,
): Promise<VerificationView> {
  const { data } = await supabase
    .from("id_verifications")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();
  const verification = (data as IdVerification | null) ?? null;

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
