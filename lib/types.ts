/** Domain types mirroring the Supabase schema (supabase/migrations). */

export type BookingStatus =
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "comped";
export type PaymentMethod = "in_person" | "stripe";

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
