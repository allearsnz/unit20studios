import {
  DetailPanel,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components/EmailLayout";

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
        locked in. Here&apos;s everything you need to get into the space.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "When", value: whenLabel },
          { label: "Where", value: "20 Southwark Street, Christchurch Central" },
        ]}
      />

      {/* TODO(Will): replace the placeholder access steps below with the real
          self-service entry instructions (door code, buzzer, which entrance,
          parking, etc). Keep it short and step-by-step. */}
      <EmailText>
        <strong style={{ color: "#f5f1ea" }}>Getting in</strong>
        <br />
        Head to 20 Southwark Street, Christchurch Central. [PLACEHOLDER — entry
        instructions: use the [door on X / buzzer / keypad code], go [up the
        stairs / down the hall] to Unit 20. Will edit this with the real steps.]
      </EmailText>

      <EmailText>
        I&apos;ll meet you at the space at your start time ({whenLabel}) to get
        you set up and answer any questions — so you don&apos;t need to sort
        anything out on your own before then.
      </EmailText>

      <EmailText>
        Bring a USB or two with your tracks, your own headphones, and photo ID if
        it&apos;s your first visit. Running late or need to move things around?
        Just reply to this email or write to studio@unit20.nz.
      </EmailText>
    </EmailLayout>
  );
}
