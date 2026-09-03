import {
  AccountPrompt,
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
} from "./components/EmailLayout";
import type { BookingEmailProps } from "./BookingConfirmed";

export default function BookingReceivedNewCustomer({
  firstName = "there",
  friendlyId = "U20-2026-0042",
  whenLabel = "Sat 1 Jun, 7:00pm – 9:00pm",
  durationHours = 2,
  tierLabel = "Up to 8 people",
  groupSize = 3,
  total = "$80.00 + GST ($92.00)",
  manageUrl = "https://studio.unit20.nz/studio/book/confirmation?id=U20-2026-0042",
  rateNote = null,
  surchargeLabel = null,
  packNote = null,
  signupUrl = null,
}: BookingEmailProps) {
  return (
    <EmailLayout
      preview={`We've got your booking request — ${friendlyId}`}
      eyebrow={`Booking / Received / ${friendlyId}`}
    >
      <EmailHeading>We&apos;ve got your request.</EmailHeading>
      <EmailText>
        Thanks, {firstName}. We&apos;re holding the slot, but since this is your
        first session it isn&apos;t confirmed until we&apos;ve checked your ID.
        There&apos;s a separate email on its way with a link — upload a photo of
        your driver licence or passport and we&apos;ll take it from there.
        It&apos;s a one-off, and after that your bookings confirm instantly.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "Requested", value: whenLabel },
          { label: "Duration", value: `${durationHours}h` },
          { label: "Room", value: `${tierLabel} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
          ...(rateNote ? [{ label: "Rate", value: rateNote }] : []),
          ...(surchargeLabel ? [{ label: "Group surcharge", value: `${surchargeLabel} · included in total` }] : []),
          { label: "Total", value: `${total} (pay in person)`, accent: true },
          { label: "Status", value: "Held — waiting on your ID upload" },
        ]}
      />

      {packNote ? <EmailText>{packNote}</EmailText> : null}

      <InfoBlock label="What happens next">
        Send us your ID through the link in the other email and we&apos;ll do
        the rest — you&apos;ll get a confirmation once you&apos;re verified. It
        has to come through the link before the day; we can&apos;t check it at
        the door. On the day, bring a USB with your tracks and your own
        headphones.
      </InfoBlock>

      <EmailButton href={manageUrl}>View request</EmailButton>
      {signupUrl ? <AccountPrompt signupUrl={signupUrl} /> : null}
    </EmailLayout>
  );
}
