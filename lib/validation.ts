import { z } from "zod";

/** Normalise an NZ phone number to E.164 (+64…). Returns null if unparseable. */
export function normalizeNZPhone(raw: string): string | null {
  const s = raw.replace(/[\s()\-.]/g, "");
  if (/^\+\d{8,15}$/.test(s)) return s; // already international
  if (/^0\d{8,10}$/.test(s)) return "+64" + s.slice(1); // 0xx… → +64xx…
  if (/^64\d{8,10}$/.test(s)) return "+" + s; // 64xx… → +64xx…
  if (/^\d{8,10}$/.test(s)) return "+64" + s; // bare local number
  return null;
}

/** Pretty NZ display: +64211234567 → 021 123 4567 (best effort). */
export function formatNZPhone(e164: string): string {
  if (e164.startsWith("+64")) {
    const local = "0" + e164.slice(3);
    if (local.length >= 9) {
      return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`.trim();
    }
    return local;
  }
  return e164;
}

/** Age in whole years at `ref` for an ISO (YYYY-MM-DD) date of birth. */
export function ageFromDob(dob: string, ref = new Date()): number {
  const d = new Date(dob + "T00:00:00");
  let age = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
  return age;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Not a real date");

/** Customer-facing booking submission payload. */
export const bookingInputSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  durationHours: z.number().int().min(1).max(2),
  tierSlug: z.enum(["small"]),
  /** Booking option chosen in the flow. Optional for legacy clients — the
   *  server infers "1h"/"2h" from durationHours when absent. */
  optionId: z.enum(["1h", "2h", "2h-daytime", "pack10"]).optional(),
  groupSize: z.number().int().min(1).max(8),
  name: z.string().trim().min(2, "Tell us your name").max(120),
  email: z.string().trim().toLowerCase().email("Check your email address").max(180),
  phone: z
    .string()
    .trim()
    .min(6, "Add a phone number")
    .max(20)
    .refine((v) => normalizeNZPhone(v) !== null, "Use a valid NZ or international number"),
  dob: isoDate.refine((v) => ageFromDob(v) >= 16, "You must be 16 or over to book"),
  customerNote: z.string().max(1000).optional().nullable(),
  /** Optional discount code. Re-validated + redeemed server-side; an invalid
   *  code never blocks the booking, it just books at full price. */
  discountCode: z.string().trim().max(40).optional().nullable(),
  agreeTerms: z.literal(true, { message: "Please accept the terms to book" }),
  marketingOptIn: z.boolean().default(false),
  source: z.string().max(160).optional().nullable(),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const CONTACT_SUBJECTS = ["Studio", "Hire", "Venue", "Other"] as const;

/** Contact form payload. */
export const contactInputSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120),
  email: z.string().trim().toLowerCase().email("Check your email address").max(180),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  subject: z.enum(CONTACT_SUBJECTS).default("Other"),
  message: z.string().trim().min(10, "A little more detail, please").max(4000),
  sourcePage: z.string().max(200).optional().nullable(),
  // honeypot — must stay empty
  company: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/**
 * Plain client-side form schema (no transforms/defaults) so the RHF resolver
 * input and output types line up. The server re-validates + normalises with
 * contactInputSchema above.
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120),
  email: z.string().trim().email("Check your email address").max(180),
  phone: z.string().trim().max(20).optional(),
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10, "A little more detail, please").max(4000),
  sourcePage: z.string().max(200).optional(),
  company: z.string().max(0).optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
