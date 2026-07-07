import {
  DetailPanel,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
  c,
} from "./components/EmailLayout";
import { site } from "@/lib/site";

const ADDRESS = `${site.address.street}, ${site.address.locality}`;

export type BookingAccessInstructionsProps = {
  firstName: string;
  friendlyId: string;
  whenLabel: string;
};

export default function BookingAccessInstructions({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
}: BookingAccessInstructionsProps) {
  return (
    <EmailLayout
      preview={`You're all set — getting into Unit 20 (${friendlyId})`}
      eyebrow={`Your session / Access / ${friendlyId}`}
    >
      <EmailHeading>You&apos;re all set.</EmailHeading>
      <EmailText>
        Thanks {firstName}, your payment&apos;s come through and your session is
        locked in. Here&apos;s everything you need for the day.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "When", value: whenLabel },
          { label: "Where", value: ADDRESS },
        ]}
      />

      <InfoBlock label="Getting in">
        Come to {ADDRESS}, {site.address.region} at your booking time. Let
        yourself in with the door code we emailed you — enter it on the keypad
        by the door, followed by the{" "}
        <span style={{ color: c.text }}>#</span> key. The code only works during
        your booked window. Can&apos;t find it? Just reply and we&apos;ll resend.
      </InfoBlock>

      <EmailText>
        Bring a USB or two with your tracks, your own headphones, and photo ID
        if it&apos;s your first visit. Running late or need to move things
        around? Just reply to this email or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>
    </EmailLayout>
  );
}
