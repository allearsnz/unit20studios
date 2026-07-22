import type { Metadata } from "next";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function AccountLoginPage() {
  return (
    <div className="container-page">
      <LoginForm />
    </div>
  );
}
