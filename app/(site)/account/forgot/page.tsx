import type { Metadata } from "next";
import { ForgotForm } from "@/components/account/ForgotForm";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function AccountForgotPage() {
  return (
    <div className="container-page">
      <ForgotForm />
    </div>
  );
}
