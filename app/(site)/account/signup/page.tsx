import type { Metadata } from "next";
import { SignupForm } from "@/components/account/SignupForm";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default function AccountSignupPage() {
  return (
    <div className="container-page">
      <SignupForm />
    </div>
  );
}
