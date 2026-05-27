import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";

export const metadata: Metadata = {
  title: "Book a session",
  description:
    "Book the Unit 20 studio in central Christchurch. Pick a time, choose your group size, and lock it in — pay in person, from $35/hr off-peak.",
  alternates: { canonical: "/studio/book" },
};

export default function BookPage() {
  return <BookingFlow />;
}
