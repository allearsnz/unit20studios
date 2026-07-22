/**
 * Render every transactional email to static HTML with representative sample
 * data, for preview sends. Run: npx tsx scripts/render-email-previews.tsx
 * Output: .email-previews/*.html (gitignored / throwaway).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@react-email/components";
import BookingConfirmed from "../emails/BookingConfirmed";
import BookingReceivedNewCustomer from "../emails/BookingReceivedNewCustomer";
import BookingAccessInstructions from "../emails/BookingAccessInstructions";
import BookingReminder from "../emails/BookingReminder";
import BookingPostSession from "../emails/BookingPostSession";
import BookingCancelled from "../emails/BookingCancelled";
import ContactForm from "../emails/ContactForm";
import RewardEarned from "../emails/RewardEarned";
import AccountWelcome from "../emails/AccountWelcome";

const sample = {
  firstName: "Will",
  friendlyId: "U20-2026-0042",
  whenLabel: "Sat 11 Jul, 7:00pm – 9:00pm",
  durationHours: 2,
  tierLabel: "Up to 8 people",
  groupSize: 3,
  total: "$80.00 + GST ($92.00)",
  manageUrl: "https://studio.unit20.nz/studio/book/confirmation?id=U20-2026-0042",
  rateNote: "10-hour pack — first 2h booked",
  surchargeLabel: "+$30.00+GST",
  packNote:
    "Your 10-hour pack is now active — 8 hours remain after this session. Book the rest whenever suits.",
};

const out = join(__dirname, "..", ".email-previews");
mkdirSync(out, { recursive: true });

async function main() {
  const jobs: [string, React.ReactElement][] = [
    ["booking-confirmed", <BookingConfirmed {...sample} />],
    ["booking-received-new-customer", <BookingReceivedNewCustomer {...sample} />],
    [
      "booking-access-instructions",
      <BookingAccessInstructions
        firstName={sample.firstName}
        friendlyId={sample.friendlyId}
        whenLabel={sample.whenLabel}
      />,
    ],
    [
      "booking-reminder",
      <BookingReminder
        firstName={sample.firstName}
        friendlyId={sample.friendlyId}
        whenLabel={sample.whenLabel}
        manageUrl={sample.manageUrl}
      />,
    ],
    [
      "booking-post-session",
      <BookingPostSession
        firstName={sample.firstName}
        bookUrl="https://studio.unit20.nz/studio/book"
      />,
    ],
    [
      "booking-cancelled",
      <BookingCancelled
        firstName={sample.firstName}
        friendlyId={sample.friendlyId}
        whenLabel={sample.whenLabel}
        bookUrl="https://studio.unit20.nz/studio/book"
      />,
    ],
    [
      "contact-form",
      <ContactForm
        name="Jane Doe"
        email="jane@example.com"
        phone="021 555 0182"
        subject="Studio booking"
        message="Hi, keen to book the studio for a b2b practice session next weekend — is Saturday evening free?"
        sourcePage="/contact"
      />,
    ],
    [
      "reward-earned",
      <RewardEarned
        firstName={sample.firstName}
        hours={20}
        code="ENCORE50"
        expiryLabel="Fri 5 Sep 2026"
        bookUrl="https://studio.unit20.nz/studio/book?code=ENCORE50"
      />,
    ],
    [
      "account-welcome",
      <AccountWelcome
        firstName={sample.firstName}
        accountUrl="https://studio.unit20.nz/account"
      />,
    ],
  ];

  for (const [name, element] of jobs) {
    const html = await render(element);
    writeFileSync(join(out, `${name}.html`), html);
    console.log(`rendered ${name}.html`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
