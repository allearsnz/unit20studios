import type { Metadata } from "next";
import { BookingFlow, type BookingAccount } from "@/components/booking/BookingFlow";
import { getCustomerSession } from "@/lib/customer-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bankedHoursBalance } from "@/lib/banked-hours";
import { getPricingSettings } from "@/lib/pricing-store";
import { formatHour, formatNZDPlusGst } from "@/lib/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPricingSettings();
  const deal = p.weekdayDeal.enabled
    ? `, or ${formatNZDPlusGst(p.weekdayDeal.twoHourPriceCents)} for two weekday-daytime hours (Mon–Fri, ${formatHour(p.weekdayDeal.windowStartHour)}–${formatHour(p.weekdayDeal.windowEndHour)})`
    : "";
  return {
    title: "Book a session",
    description: `Book the Unit 20 studio in central Christchurch. Pick a time, choose your group size, and lock it in — pay in person. ${formatNZDPlusGst(p.rates.oneHourCents)} an hour, ${formatNZDPlusGst(p.rates.twoHourCents)} for two${deal}.`,
    alternates: { canonical: "/studio/book" },
  };
}

// Dynamic so a signed-in customer's details + banked balance prefill the flow.
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const [session, pricing] = await Promise.all([getCustomerSession(), getPricingSettings()]);

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
      name: customer?.name ?? user.name ?? "",
      email: customer?.email ?? user.email ?? "",
      phone: customer?.phone ?? "",
      dob: customer?.dob ?? "",
      bankedHours,
    };
  }

  return <BookingFlow account={account} pricing={pricing} />;
}
