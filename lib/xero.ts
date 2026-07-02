import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Xero webhook + Accounting API helpers.
 *
 * Auth model: a Xero **Custom Connection** (OAuth2 client-credentials,
 * machine-to-machine, scoped to a single organisation). This avoids storing and
 * refreshing a user token — we exchange client id/secret for a short-lived
 * access token on demand. Env: XERO_CLIENT_ID, XERO_CLIENT_SECRET,
 * XERO_TENANT_ID. Webhook signing key: XERO_WEBHOOK_KEY.
 *
 * Docs (bundled with Next): none — external. See
 * https://developer.xero.com/documentation/guides/webhooks/overview and
 * https://developer.xero.com/documentation/guides/oauth2/custom-connections
 */

const TOKEN_URL = "https://identity.xero.com/connect/token";
const API_BASE = "https://api.xero.com/api.xro/2.0";

/**
 * Verify Xero's `x-xero-signature`: base64(HMAC-SHA256(rawBody, webhookKey)).
 * Uses the RAW request body (not re-serialized JSON) and a constant-time
 * compare. Returns false if the key is unset or the header is missing/mismatched
 * (Xero's "intent to receive" handshake expects 401 on a bad signature).
 */
export function verifyXeroSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.XERO_WEBHOOK_KEY;
  if (!key || !signature) return false;
  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type XeroWebhookEvent = {
  resourceUrl: string;
  resourceId: string;
  eventDateUtc: string;
  eventType: string; // CREATE | UPDATE | DELETE
  eventCategory: string; // INVOICE, CONTACT, ...
  tenantId: string;
  tenantType: string;
};

export type XeroWebhookPayload = {
  events: XeroWebhookEvent[];
  firstEventSequence: number;
  lastEventSequence: number;
  entropy: string;
};

export type XeroInvoice = {
  InvoiceID: string;
  InvoiceNumber?: string;
  Reference?: string;
  Status?: string; // DRAFT | SUBMITTED | AUTHORISED | PAID | VOIDED | DELETED
  AmountDue?: number;
  AmountPaid?: number;
  Total?: number;
  Type?: string; // ACCREC | ACCPAY
};

function xeroCredsConfigured(): boolean {
  return Boolean(
    process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET && process.env.XERO_TENANT_ID,
  );
}

/**
 * Exchange the Custom Connection client id/secret for a short-lived access
 * token (client-credentials grant). No token caching — these calls are rare
 * (only on a Xero webhook) and the token is single-use here.
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Xero client credentials not configured");
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "accounting.transactions.read",
    }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero token exchange failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Xero token response missing access_token");
  return json.access_token;
}

/** Fetch a single invoice by its Xero InvoiceID. Returns null if not found. */
export async function fetchXeroInvoice(invoiceId: string): Promise<XeroInvoice | null> {
  if (!xeroCredsConfigured()) {
    throw new Error("Xero API not configured (XERO_CLIENT_ID/SECRET/TENANT_ID)");
  }
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/Invoices/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-tenant-id": process.env.XERO_TENANT_ID as string,
      Accept: "application/json",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero invoice fetch failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { Invoices?: XeroInvoice[] };
  return json.Invoices?.[0] ?? null;
}

/**
 * A sales invoice is settled once Xero moves it to PAID (this only happens when
 * AmountDue reaches 0). We treat AmountDue<=0 as a belt-and-braces fallback.
 */
export function isInvoiceFullyPaid(invoice: XeroInvoice): boolean {
  if (invoice.Status === "PAID") return true;
  return invoice.AmountDue !== undefined && invoice.AmountDue <= 0 && (invoice.AmountPaid ?? 0) > 0;
}
