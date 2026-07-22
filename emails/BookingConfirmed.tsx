import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
  c,
} from "./components/EmailLayout";
import { site } from "@/lib/site";

const ADDRESS = `${site.address.street}, ${site.address.locality}`;

export type BookingEmailProps = {
  firstName: string;
  friendlyId: string;
  whenLabel: string;
  durationHours: number;
  tierLabel: string;
  groupSize: number;
  total: string;
  manageUrl: string;
  /** Rate applied, e.g. "10-hour pack — first 2h booked". */
  rateNote?: string | null;
  /** Group surcharge included in the total, e.g. "+$30.00+GST". */
  surchargeLabel?: string | null;
  /** Extra paragraph for 10-hour pack bookings. */
  packNote?: string | null;
};

export default function BookingConfirmed({
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
}: BookingEmailProps) {
  return (
    <EmailLayout
      preview={`You're booked — ${friendlyId}`}
      eyebrow={`Booking / Confirmed / ${friendlyId}`}
    >
      <EmailHeading>You&apos;re booked.</EmailHeading>
      <EmailText>
        Nice one, {firstName}. Your session at Unit 20 is locked in. We&apos;ve
        attached a calendar invite — see you in the booth.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Reference", value: friendlyId },
          { label: "When", value: whenLabel },
          { label: "Where", value: ADDRESS },
          { label: "Duration", value: `${durationHours}h` },
          { label: "Room", value: `${tierLabel} · ${groupSize} ${groupSize === 1 ? "person" : "people"}` },
          ...(rateNote ? [{ label: "Rate", value: rateNote }] : []),
          ...(surchargeLabel ? [{ label: "Group surcharge", value: `${surchargeLabel} · included in total` }] : []),
          { label: "Total", value: `${total} — pay in person`, accent: true },
        ]}
      />

      {packNote ? <EmailText>{packNote}</EmailText> : null}

      <InfoBlock label="Getting in">
        Come to {ADDRESS} at your booking time — someone from Unit 20 will meet
        you there and let you in, so there&apos;s nothing to sort out
        beforehand.
      </InfoBlock>

      <EmailText>
        Turn up a couple of minutes early. Bring a USB or two with your tracks,
        your own headphones, and photo ID if it&apos;s your first visit. Need to
        move it? Reply to this email or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>

      <EmailButton href={manageUrl}>View booking</EmailButton>
    </EmailLayout>
  );
}
