import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
  c,
} from "./components/EmailLayout";

export type AccountWelcomeProps = {
  firstName: string;
  /** Link to the customer dashboard. */
  accountUrl: string;
};

export default function AccountWelcome({
  firstName = "there",
  accountUrl = "https://studio.unit20.nz/account",
}: AccountWelcomeProps) {
  return (
    <EmailLayout
      preview="Your Unit 20 account is live"
      eyebrow="Studio / Account"
    >
      <EmailHeading>Your account is live.</EmailHeading>
      <EmailText>
        Welcome in, {firstName}. Everything to do with your time at Unit 20 now lives in one
        place — sign in any time to pick up where you left off.
      </EmailText>

      <InfoBlock label="What's inside">
        Your upcoming and past sessions, your total play time, any banked hours from a 10-hour
        pack, and the reward codes you earn every 10 hours of play.
      </InfoBlock>

      <EmailButton href={accountUrl}>Go to my account</EmailButton>

      <EmailText>
        Booked with us before signing up? Your history connects automatically to this email.
        Questions? Just reply, or write to{" "}
        <span style={{ color: c.text }}>studio@unit20.nz</span>.
      </EmailText>
    </EmailLayout>
  );
}
