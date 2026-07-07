import { createHmac, timingSafeEqual } from "node:crypto";
import { BULK_PACK, groupSurchargeCents } from "./pricing";

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
 * Read + write scope for the Custom Connection. `accounting.transactions`
 * (superset of `.read`) covers reading/creating invoices; `accounting.contacts`
 * covers finding/creating the customer contact. These scopes must ALSO be
 * granted to the Custom Connection app in the Xero developer portal.
 */
const XERO_SCOPE = "accounting.transactions accounting.contacts";

/**
 * Exchange the Custom Connection client id/secret for a short-lived access
 * token (client-credentials grant). No token caching — call volume is tiny; a
 * single token comfortably covers the 3–4 API calls of one invoice operation,
 * so callers fetch one and thread it through.
 */
export async function getAccessToken(scope: string = XERO_SCOPE): Promise<string> {
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
      scope,
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

/** Common headers for an authenticated Accounting API call. */
function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Xero-tenant-id": process.env.XERO_TENANT_ID as string,
    Accept: "application/json",
  };
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

// ---------------------------------------------------------------------------
// Write helpers (contacts + invoices). Used by lib/xero-booking.ts to raise an
// invoice on booking approval. All best-effort orchestration + rollback lives
// there; these are thin wrappers over the Accounting API that throw on failure.
// ---------------------------------------------------------------------------

/**
 * NZ 15% GST on income. Verify once against the org during setup rather than
 * trusting the constant — GET /TaxRates and confirm the TaxType for the studio
 * revenue account is "OUTPUT2".
 * TODO(setup): verify OUTPUT2 via GET https://api.xero.com/api.xro/2.0/TaxRates
 */
const GST_TAX_TYPE = "OUTPUT2";

type XeroContact = { ContactID: string; Name?: string; EmailAddress?: string };

/** Escape a value for a Xero `where` string literal (double the quotes). */
function xeroQuote(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Find a Xero contact by email, creating one if none exists. Matches on
 * EmailAddress first (Xero's optimised filter set); on create, Xero requires a
 * UNIQUE contact Name, so a name collision falls back to "Name (email)".
 * Returns the ContactID. Throws on API failure.
 */
export async function findOrCreateContact(
  args: { name: string; email: string; phone?: string | null },
  token?: string,
): Promise<string> {
  const t = token ?? (await getAccessToken());
  const email = args.email.trim().toLowerCase();
  const name = args.name.trim() || email;

  // 1. Match by email.
  const where = encodeURIComponent(`EmailAddress=="${xeroQuote(email)}"`);
  const findRes = await fetch(`${API_BASE}/Contacts?where=${where}`, { headers: apiHeaders(t) });
  if (findRes.ok) {
    const json = (await findRes.json()) as { Contacts?: XeroContact[] };
    const hit = json.Contacts?.find((c) => c.EmailAddress?.toLowerCase() === email) ?? json.Contacts?.[0];
    if (hit?.ContactID) return hit.ContactID;
  } else if (findRes.status !== 404) {
    const detail = await findRes.text().catch(() => "");
    throw new Error(`Xero contact lookup failed (${findRes.status}): ${detail}`);
  }

  // 2. Create. Retry once with a disambiguated name on a unique-name clash.
  const create = async (contactName: string) =>
    fetch(`${API_BASE}/Contacts`, {
      method: "POST",
      headers: { ...apiHeaders(t), "Content-Type": "application/json" },
      body: JSON.stringify({
        Contacts: [
          {
            Name: contactName,
            EmailAddress: email,
            ...(args.phone ? { Phones: [{ PhoneType: "MOBILE", PhoneNumber: args.phone }] } : {}),
          },
        ],
      }),
    });

  let res = await create(name);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (/name/i.test(detail) && /(already|exist|unique)/i.test(detail)) {
      res = await create(`${name} (${email})`);
    }
    if (!res.ok) {
      const detail2 = res.bodyUsed ? detail : await res.text().catch(() => detail);
      throw new Error(`Xero contact create failed (${res.status}): ${detail2}`);
    }
  }
  const json = (await res.json()) as { Contacts?: XeroContact[] };
  const created = json.Contacts?.[0];
  if (!created?.ContactID) throw new Error("Xero contact create returned no ContactID");
  return created.ContactID;
}

/** Minimal booking shape needed to build invoice line items. */
export type InvoiceBooking = {
  id: string;
  friendly_id: string;
  duration_hours: number;
  group_size: number;
  total_price_cents: number; // NET of any discount
  /** Ex-GST discount applied (0 when none). Shown as a negative invoice line. */
  discount_amount_cents?: number;
  start_time: string;
  end_time: string | null;
};

/** "YYYY-MM-DD" (UTC date) for a Xero Date/DueDate field. */
function xeroDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Create an approved ACCREC sales invoice for a booking, mirroring the stored
 * price: a base session (or 10-hour pack) line plus an optional group-surcharge
 * line, all ex-GST (LineAmountTypes Exclusive). Reference is the booking
 * friendly_id so the webhook can also match by Reference. An Idempotency-Key
 * makes a retried create return the original invoice instead of duplicating.
 * Throws on API failure.
 */
export async function createBookingInvoice(
  args: { contactId: string; booking: InvoiceBooking; whenLabel: string },
  token?: string,
): Promise<XeroInvoice> {
  const t = token ?? (await getAccessToken());
  const { contactId, booking, whenLabel } = args;
  const accountCode = process.env.XERO_ACCOUNT_CODE;
  if (!accountCode) throw new Error("XERO_ACCOUNT_CODE not configured");

  // `total_price_cents` is net of any discount. Rebuild the GROSS subtotal so the
  // base/surcharge lines show the pre-discount figures and the discount appears
  // as its own negative line; the invoice still totals the net amount.
  const discountCents = booking.discount_amount_cents ?? 0;
  const grossTotal = booking.total_price_cents + discountCents;
  const surchargeCents = groupSurchargeCents(booking.duration_hours, booking.group_size);
  const baseCents = grossTotal - surchargeCents;
  const isPack = baseCents === BULK_PACK.totalCents;

  const lineItems: Record<string, unknown>[] = [
    {
      Description: isPack
        ? `Studio 10-hour pack (prepaid) — first session ${whenLabel} (${booking.duration_hours}h)`
        : `Studio session — ${whenLabel} (${booking.duration_hours}h)`,
      Quantity: 1,
      UnitAmount: (baseCents / 100).toFixed(2),
      AccountCode: accountCode,
      TaxType: GST_TAX_TYPE,
    },
  ];
  if (surchargeCents > 0) {
    lineItems.push({
      Description: `Group surcharge (${booking.group_size} people)`,
      Quantity: 1,
      UnitAmount: (surchargeCents / 100).toFixed(2),
      AccountCode: accountCode,
      TaxType: GST_TAX_TYPE,
    });
  }
  if (discountCents > 0) {
    lineItems.push({
      Description: "Discount code",
      Quantity: 1,
      UnitAmount: (-discountCents / 100).toFixed(2),
      AccountCode: accountCode,
      TaxType: GST_TAX_TYPE,
    });
  }

  // DueDate: payment before the session is the point — due the session day, or
  // 5 days out for far-future/undated bookings, whichever is sooner.
  const now = new Date();
  const sessionDay = booking.start_time ? new Date(booking.start_time) : null;
  const fiveDays = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
  const due = sessionDay && sessionDay > now && sessionDay < fiveDays ? sessionDay : fiveDays;

  const brandingThemeId = process.env.XERO_BRANDING_THEME_ID;
  const body = {
    Type: "ACCREC",
    Contact: { ContactID: contactId },
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    Reference: booking.friendly_id,
    Date: xeroDate(now),
    DueDate: xeroDate(due),
    LineItems: lineItems,
    ...(brandingThemeId ? { BrandingThemeID: brandingThemeId } : {}),
  };

  const res = await fetch(`${API_BASE}/Invoices`, {
    method: "POST",
    headers: {
      ...apiHeaders(t),
      "Content-Type": "application/json",
      "Idempotency-Key": `booking:${booking.id}:invoice`,
    },
    body: JSON.stringify({ Invoices: [body] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero invoice create failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { Invoices?: XeroInvoice[] };
  const invoice = json.Invoices?.[0];
  if (!invoice?.InvoiceID) throw new Error("Xero invoice create returned no InvoiceID");
  return invoice;
}

/**
 * Fetch the customer-facing "online invoice" (pay-now) URL for an invoice.
 * Only works for non-DRAFT ACCREC invoices. Returns null if none is available.
 */
export async function getOnlineInvoiceUrl(invoiceId: string, token?: string): Promise<string | null> {
  const t = token ?? (await getAccessToken());
  const res = await fetch(`${API_BASE}/Invoices/${encodeURIComponent(invoiceId)}/OnlineInvoice`, {
    headers: apiHeaders(t),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero online-invoice fetch failed (${res.status}): ${detail}`);
  }
  const json = (await res.json()) as { OnlineInvoices?: { OnlineInvoiceUrl?: string }[] };
  return json.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;
}

/**
 * Ask Xero to email the invoice to the contact (Xero sends its own branded
 * invoice email, with the Pay Now button when a payment service is enabled).
 * This also marks the invoice as "sent". Throws on API failure.
 */
export async function emailInvoice(invoiceId: string, token?: string): Promise<void> {
  const t = token ?? (await getAccessToken());
  const res = await fetch(`${API_BASE}/Invoices/${encodeURIComponent(invoiceId)}/Email`, {
    method: "POST",
    headers: { ...apiHeaders(t), "Content-Type": "application/json" },
    // Empty body → Xero emails using the invoice's contact + branding defaults.
    body: JSON.stringify({}),
  });
  // 200 or 204 both indicate success.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Xero invoice email failed (${res.status}): ${detail}`);
  }
}
