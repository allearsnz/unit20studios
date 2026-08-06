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
  /**
   * True when a door code exists for this booking. The crew-side trigger only
   * mints one if the payment lands before the session ends, so a session
   * squared up afterwards has no code — and telling that customer to use one
   * would send them to a keypad with nothing to type. See sendAccessInstructions.
   */
  hasDoorCode?: boolean;
};

export default function BookingAccessInstructions({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
  hasDoorCode = true,
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
        {hasDoorCode ? (
          <>
            {ADDRESS}, {site.address.region}. Your door code arrives in a
            separate email — punch it into the keypad by the roller door,
            then <span style={{ color: c.text }}>#</span>. It only works during
            your booked window. No code yet? Reply and we&apos;ll sort it.
          </>
        ) : (
          <>
            {ADDRESS}, {site.address.region}. Buzz the roller door on the street
            and we&apos;ll let you in.
          </>
        )}
      </InfoBlock>

      <EmailText>
        Bring a USB or two with your tracks and your own headphones. Running
        late or need to move things around? Reply to this email.
      </EmailText>
    </EmailLayout>
  );
}
