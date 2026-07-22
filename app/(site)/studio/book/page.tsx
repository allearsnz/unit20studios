import type { Metadata } from "next";
import { BookingFlow, type BookingAccount } from "@/components/booking/BookingFlow";
import { getCustomerSession } from "@/lib/customer-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bankedHoursBalance } from "@/lib/banked-hours";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Book the Unit 20 studio in central Christchurch. Pick a time, choose your group size, and lock it in — pay in person. $50+GST an hour, $80+GST for two, or $60+GST for two weekday-daytime hours (Mon–Fri, 10am–4pm).",
  alternates: { canonical: "/studio/book" },
};

// Dynamic so a signed-in customer's details + banked balance prefill the flow.
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const session = await getCustomerSession();

  let account: BookingAccount | null = null;
  if (session) {
    const { user, customer } = session;
    let bankedHours = 0;
    if (customer) {
      try {
        bankedHours = await bankedHoursBalance(createAdminClient(), customer.id);
      } catch {
        bankedHours = 0;
      }
    }
    account = {
      name: customer?.name ?? (user.user_metadata?.name as string | undefined) ?? "",
      email: customer?.email ?? user.email ?? "",
      phone: customer?.phone ?? "",
      dob: customer?.dob ?? "",
      bankedHours,
    };
  }

  return <BookingFlow account={account} />;
}
