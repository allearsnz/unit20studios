import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components/EmailLayout";

export type BookingCancelledProps = {
  firstName: string;
  friendlyId: string;
  whenLabel: string;
  bookUrl: string;
};

export default function BookingCancelled({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
  bookUrl = "https://studio.unit20.nz/studio/book",
}: BookingCancelledProps) {
  return (
    <EmailLayout
      preview={`Your booking ${friendlyId} has been cancelled`}
      eyebrow={`Booking / Cancelled / ${friendlyId}`}
    >
      <EmailHeading>Booking cancelled.</EmailHeading>
      <EmailText>
        Hi {firstName}, we&apos;ve cancelled the session below. If this
        wasn&apos;t expected, or you&apos;d like to rebook, just reply to this
        email or grab another time online — no hard feelings either way.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "Was", value: whenLabel },
          { label: "Status", value: "Cancelled" },
        ]}
      />

      <EmailButton href={bookUrl}>Book another session</EmailButton>
    </EmailLayout>
  );
}
