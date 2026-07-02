import {
  DetailPanel,
  EmailHeading,
  EmailLayout,
  EmailText,
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
    <EmailLayout preview={`You're all set — getting into Unit 20 (${friendlyId})`}>
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

      <EmailText>
        <strong style={{ color: "#f5f1ea" }}>Getting in</strong>
        <br />
        Come to {ADDRESS}, {site.address.region} at your booking time. Someone
        from Unit 20 will meet you at the door, let you in and get you set up on
        the decks — there&apos;s no code or keypad to worry about, and nothing to
        sort out on your own beforehand.
      </EmailText>

      <EmailText>
        Bring a USB or two with your tracks, your own headphones, and photo ID if
        it&apos;s your first visit. Running late or need to move things around?
        Just reply to this email or write to studio@unit20.nz.
      </EmailText>
    </EmailLayout>
  );
}
