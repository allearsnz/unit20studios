"use server";

import { createElement } from "react";
import { getCustomerSession } from "@/lib/customer-auth";
import { sendEmail, notifyAdmin } from "@/lib/email";
import { site } from "@/lib/site";
import AccountWelcome from "@/emails/AccountWelcome";

/**
 * Called right after a customer finishes sign-up (email verified + password
 * set). `getCustomerSession()` links/backfills any pre-existing customers row
 * to the new auth user; then we send a welcome email and ping the admin. All
 * best-effort — a failure here never blocks account creation.
 */
export async function completeAccountSetup(): Promise<void> {
  const session = await getCustomerSession();
  if (!session) return;

  const email = session.user.email;
  if (!email) return;

  const name =
    session.customer?.name ||
    (session.user.user_metadata?.name as string | undefined) ||
    "there";
  const firstName = name.split(/\s+/)[0] || "there";

  try {
    await sendEmail({
      to: email,
      subject: "Your Unit 20 account is live",
      react: createElement(AccountWelcome, {
        firstName,
        accountUrl: `${site.url}/account`,
      }),
    });
  } catch {
    /* email is best-effort */
  }

  await notifyAdmin(
    "New customer account",
    `${name}\n${email}\n\n${site.url}/admin/customers`,
  );
}
