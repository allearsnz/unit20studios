import { z } from "zod";
import { ageFromDob, normalizeNZPhone } from "@/lib/validation";

export type Slot = {
  start: string; // ISO
  end: string; // ISO
  available: boolean;
  is_peak: boolean;
};

export type Selection = { startIdx: number; count: number };

export const MAX_HOURS = 2;

/** Details step schema (RHF resolver). Mirrors the server's bookingInputSchema. */
export const detailsSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name").max(120),
  email: z.string().trim().email("Check your email address").max(180),
  phone: z
    .string()
    .trim()
    .min(6, "Add a phone number")
    .refine((v) => normalizeNZPhone(v) !== null, "Use a valid NZ or international number"),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Add your date of birth")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Not a real date")
    .refine((v) => ageFromDob(v) >= 18, "You must be 18 or over to book"),
  customerNote: z.string().max(1000).optional(),
});

export type DetailsValues = z.infer<typeof detailsSchema>;
