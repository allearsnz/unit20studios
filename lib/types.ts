/** Domain types mirroring the Supabase schema (supabase/migrations). */

export type BookingStatus =
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "comped";
export type PaymentMethod = "in_person" | "stripe";

/**
 * Xero invoicing state machine (independent of booking `status` /
 * `payment_status`). `creating` is the transient claim used to make invoice
 * creation exactly-once. See supabase migration 0009 (crew 0057).
 */
export type InvoiceStatus =
  | "not_invoiced"
  | "creating"
  | "authorised"
  | "paid"
  | "voided";

export interface PricingTier {
  id: string;
  slug: "small";
  label: string;
  max_people: number;
  peak_1h_price_cents: number;
  peak_2h_price_cents: number;
  peak_extra_hour_price_cents: number;
  off_peak_multiplier: number;
  sort_order: number;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  dob: string; // YYYY-MM-DD
  id_verified: boolean;
  id_verified_at: string | null;
  marketing_opt_in: boolean;
  notes: string | null;
  // Customer accounts (supabase migration 0011). `auth_user_id` links this row
  // to a Supabase auth user (null = anonymous customer, no account yet).
  // `rewards_granted_hours` is the highest 10-hour play-time multiple already
  // rewarded — the idempotency guard for milestone-reward minting.
  auth_user_id: string | null;
  rewards_granted_hours: number;
  created_at: string;
  updated_at: string;
}

/** Reason an hour-ledger entry was written (supabase migration 0012). */
export type HourLedgerReason =
  | "pack_purchase"
  | "session_used"
  | "session_refund"
  | "adjustment";

/**
 * One append-only banked-hours movement. Balance = sum(delta_hours) for a
 * customer. Credits (pack_purchase / session_refund / positive adjustment) are
 * plain service-role inserts; debits (session_used) go through the atomic
 * `debit_banked_hours` RPC so the balance can never go negative.
 */
export interface HourLedgerEntry {
  id: string;
  customer_id: string;
  delta_hours: number;
  reason: HourLedgerReason;
  booking_id: string | null;
  note: string | null;
  created_at: string;
}

/** Lifecycle of a discount code (supabase migration 0010 / crew 0058). */
export type DiscountStatus = "active" | "disabled" | "expired";

/**
 * A percentage discount code. Emitted from a booking (single-use, 60-day
 * expiry, tied to a customer + booking) or created manually in the admin
 * "Discounts" tab. `max_uses` null = unlimited (reusable campaign code).
 * `percent` is applied to the ex-GST subtotal; the +GST display is unchanged.
 */
export interface DiscountCode {
  id: string;
  code: string; // stored UPPERCASE
  percent: number; // 1..100
  status: DiscountStatus;
  max_uses: number | null; // null = unlimited
  used_count: number;
  expires_at: string | null;
  customer_id: string | null;
  booking_id: string | null;
  note: string | null;
  // Reward codes (supabase migration 0011): when true the code applies to
  // standard rates only (1h / 2h / weekday-daytime) and is refused on the
  // 10-hour pack. Enforced server-side in the booking API + validate route.
  standard_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  friendly_id: string;
  customer_id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  pricing_tier_id: string;
  group_size: number;
  total_price_cents: number;
  // Discount codes (supabase migration 0010 / crew 0058). `total_price_cents`
  // is the NET (post-discount) ex-GST total; `discount_amount_cents` is how
  // much came off (0 when none applied).
  discount_code_id: string | null;
  discount_amount_cents: number;
  // Banked hours drawn by this booking (supabase migration 0011). 0 = a normal
  // cash booking; >0 = a prepaid-pack session that debited the customer's ledger.
  banked_hours_used: number;
  is_peak: boolean;
  status: BookingStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  source: string | null;
  customer_note: string | null;
  internal_note: string | null;
  reminder_sent_at: string | null;
  post_session_sent_at: string | null;
  access_sent_at: string | null;
  // Xero invoicing (supabase migration 0009 / crew 0057).
  xero_invoice_id: string | null;
  online_invoice_url: string | null;
  invoice_status: InvoiceStatus;
  invoiced_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlackoutPeriod {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
}

/** A recurring (permanent) weekly blackout rule — e.g. weekdays 10:00–15:00. */
export interface RecurringBlackout {
  id: string;
  /** NZ-local weekdays: 0=Sun … 6=Sat (matches JS getDay). */
  days_of_week: number[];
  /** Local-time window, minutes from NZ midnight (600 = 10:00). */
  start_minute: number;
  end_minute: number;
  reason: string | null;
  active: boolean;
  created_at: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source_page: string | null;
  ip_address: string | null;
  created_at: string;
}

/** Booking joined with its customer + tier — used in admin views. */
export interface BookingWithRelations extends Booking {
  customer: Customer;
  pricing_tier: PricingTier;
}
