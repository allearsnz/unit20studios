import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  c,
} from "./components/EmailLayout";

export type BookingReminderProps = {
  firstName: string;
  friendlyId: string;
  whenLabel: string;
  manageUrl: string;
};

export default function BookingReminder({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
  manageUrl = "https://studio.unit20.nz/studio/book/confirmation?id=U20-2026-0042",
}: BookingReminderProps) {
  return (
    <EmailLayout
      preview={`Your session is coming up — ${friendlyId}`}
      eyebrow={`Reminder / 24 hours out / ${friendlyId}`}
    >
      <EmailHeading>See you soon.</EmailHeading>
      <EmailText>
        Quick reminder, {firstName} — your Unit 20 session is about 24 hours
        away. Bring a USB or two with your tracks, your own headphones, and
        photo ID if it&apos;s your first visit. Buzz the roller door on
        Southwark Street when you arrive.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "When", value: whenLabel, accent: true },
          { label: "Where", value: "20 Southwark Street, Christchurch" },
        ]}
      />

      <EmailText>
        Need to move or cancel? Give us a heads-up at least 24 hours out — reply
        to this email or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>

      <EmailButton href={manageUrl}>View booking</EmailButton>
    </EmailLayout>
  );
}
