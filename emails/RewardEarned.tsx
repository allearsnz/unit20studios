import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
  c,
} from "./components/EmailLayout";

export type RewardEarnedProps = {
  firstName: string;
  /** The milestone reached, in hours (10, 20, …). */
  hours: number;
  code: string;
  /** Human expiry line, e.g. "Fri 5 Sep 2026". */
  expiryLabel: string;
  /** Deep link that pre-fills the code on the booking form. */
  bookUrl: string;
};

export default function RewardEarned({
  firstName = "there",
  hours = 10,
  code = "ENCORE50",
  expiryLabel = "Fri 5 Sep 2026",
  bookUrl = "https://studio.unit20.nz/studio/book?code=ENCORE50",
}: RewardEarnedProps) {
  return (
    <EmailLayout
      preview={`50% off — ${hours} hours played. Code ${code}`}
      eyebrow={`Studio / ${hours} hours played`}
    >
      <EmailHeading>That&rsquo;s {hours} hours in the booth.</EmailHeading>
      <EmailText>
        Nice work, {firstName}. You&rsquo;ve clocked {hours} hours of play time at Unit 20 — so
        here&rsquo;s 50% off your next standard session. Consider it on us.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Your code", value: code, accent: true },
          { label: "Reward", value: "50% off · standard rates" },
          { label: "Good until", value: expiryLabel },
          { label: "Uses", value: "Single use — just for you" },
        ]}
      />

      <InfoBlock label="Where it works">
        Applies to 1-hour, 2-hour and weekday-daytime sessions. Not valid on the 10-hour pack.
        Tap below and the code&rsquo;s already in — 50% comes off before you confirm.
      </InfoBlock>

      <EmailButton href={bookUrl}>Book with your reward</EmailButton>

      <EmailText>
        The code works once and expires on {expiryLabel}. Keep playing — another reward lands
        every 10 hours. Questions? Just reply, or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>
    </EmailLayout>
  );
}
