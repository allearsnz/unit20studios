import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
} from "./components/EmailLayout";

export type IdVerificationRequestProps = {
  firstName?: string;
  verifyUrl?: string;
  expiryDays?: number;
};

export default function IdVerificationRequest({
  firstName = "there",
  verifyUrl = "https://studio.unit20.nz/verify-id/example-token",
  expiryDays = 30,
}: IdVerificationRequestProps) {
  return (
    <EmailLayout
      preview="Verify your ID to confirm your Unit 20 booking"
      eyebrow="Studio / ID check"
    >
      <EmailHeading>One quick thing.</EmailHeading>
      <EmailText>
        Thanks for booking, {firstName}. Before your first session we need to
        check your ID — it&apos;s a one-off, and once it&apos;s done you never
        have to do it again.
      </EmailText>
      <EmailText>
        Tap below and upload a photo of the <strong>front and back</strong> of
        your driver licence, or the photo page of your passport. A clear phone
        photo is fine.
      </EmailText>

      <EmailButton href={verifyUrl}>Verify my ID</EmailButton>

      <InfoBlock label="What happens to it">
        The upload is private, only we can see it, and we delete both images the
        moment your ID is approved. The link is just for you and stops working
        after {expiryDays} days — if it expires, reply to this email and
        we&apos;ll send a fresh one.
      </InfoBlock>

      <EmailText>
        Your booking is held either way — approving your ID is what turns it
        into a confirmed session. Questions? Just reply.
      </EmailText>
    </EmailLayout>
  );
}
