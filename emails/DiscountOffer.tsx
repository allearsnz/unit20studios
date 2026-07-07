import {
  DetailPanel,
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
  c,
} from "./components/EmailLayout";

export type DiscountOfferProps = {
  firstName: string;
  percent: number;
  code: string;
  /** Human expiry line, e.g. "Fri 5 Sep 2026". */
  expiryLabel: string;
  /** Deep link that pre-fills the code on the booking form. */
  bookUrl: string;
};

export default function DiscountOffer({
  firstName = "there",
  percent = 15,
  code = "REMIX15",
  expiryLabel = "Fri 5 Sep 2026",
  bookUrl = "https://studio.unit20.nz/studio/book?code=REMIX15",
}: DiscountOfferProps) {
  return (
    <EmailLayout
      preview={`${percent}% off your next Unit 20 session — code ${code}`}
      eyebrow={`Studio / ${percent}% off / just for you`}
    >
      <EmailHeading>Come back for {percent}% off.</EmailHeading>
      <EmailText>
        Thanks for booking with us, {firstName}. We loved having you in the
        booth — so here&apos;s {percent}% off your next session at Unit 20. Line
        up a track, grab your crew, and pick a time that suits.
      </EmailText>

      <DetailPanel
        rows={[
          { label: "Your code", value: code, accent: true },
          { label: "Discount", value: `${percent}% off the session rate` },
          { label: "Good until", value: expiryLabel },
          { label: "Uses", value: "Single use — just for you" },
        ]}
      />

      <InfoBlock label="How it works">
        Tap the button below and your code is already in — the {percent}% comes
        off automatically before you confirm. Or enter{" "}
        <span style={{ color: c.text }}>{code}</span> in the discount field when
        you book.
      </InfoBlock>

      <EmailButton href={bookUrl}>Book with your code</EmailButton>

      <EmailText>
        Heads up — the code works once and expires on {expiryLabel}. Questions?
        Just reply, or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>
    </EmailLayout>
  );
}
