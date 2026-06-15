import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components/EmailLayout";

export type BookingEmailProps = {
  firstName: string;
  friendlyId: string;
  whenLabel: string;
  durationHours: number;
  tierLabel: string;
  groupSize: number;
  total: string;
  manageUrl: string;
};

export default function BookingConfirmed({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
  durationHours = 2,
  tierLabel = "Up to 5 people",
  groupSize = 3,
  total = "$75.00+GST",
  manageUrl = "https://unit20.nz/studio/book/confirmation?id=U20-2026-0042",
}: BookingEmailProps) {
  return (
    <EmailLayout preview={`You're booked — ${friendlyId}`}>
      <EmailHeading>You&apos;re booked.</EmailHeading>
      <EmailText>
        Nice one, {firstName}. Your session at Unit 20 is locked in. We&apos;ve
        attached a calendar invite — see you in the booth.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "When", value: whenLabel },
          { label: "Duration", value: `${durationHours}h` },
          { label: "Room", value: `${tierLabel} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
          { label: "Total", value: `${total} (pay in person)`, accent: true },
        ]}
      />

      <EmailText>
        Turn up a couple of minutes early. Bring a USB or two with your tracks,
        your own headphones, and photo ID if it&apos;s your first visit. Need to
        move it? Reply to this email or write to studio@unit20.nz.
      </EmailText>

      <EmailButton href={manageUrl}>View booking</EmailButton>
    </EmailLayout>
  );
}
