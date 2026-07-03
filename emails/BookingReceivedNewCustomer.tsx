import {
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
  manageUrl = "https://unit20.nz/studio/book/confirmation?id=U20-2026-0042",
  rateNote = null,
  surchargeLabel = null,
  packNote = null,
}: BookingEmailProps) {
  return (
    <EmailLayout
      preview={`We've got your booking request — ${friendlyId}`}
      eyebrow={`Booking / Received / ${friendlyId}`}
    >
      <EmailHeading>We&apos;ve got your request.</EmailHeading>
      <EmailText>
        Thanks, {firstName}. Since this is your first session, we just need to
        check your ID before it&apos;s fully confirmed — bring photo ID (driver
        licence, passport or similar) when you arrive and you&apos;re set.
        We&apos;ll be in touch shortly to lock it in.
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
          { label: "Status", value: "Pending — needs ID" },
        ]}
      />

      {packNote ? <EmailText>{packNote}</EmailText> : null}

      <InfoBlock label="What happens next">
        Hold tight — you don&apos;t need to do anything else right now. We
        review new bookings quickly and you&apos;ll get a confirmation once
        you&apos;re verified. Questions? Just reply to this email.
      </InfoBlock>

      <EmailButton href={manageUrl}>View request</EmailButton>
    </EmailLayout>
  );
}
