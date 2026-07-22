import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
  InfoBlock,
} from "./components/EmailLayout";

export type BookingPostSessionProps = {
  firstName: string;
  bookUrl: string;
};

export default function BookingPostSession({
  firstName = "there",
  bookUrl = "https://studio.unit20.nz/studio/book",
}: BookingPostSessionProps) {
  return (
    <EmailLayout preview="How was the session?" eyebrow="Post-session">
      <EmailHeading>How&apos;d it go?</EmailHeading>
      <EmailText>
        Thanks for using the room, {firstName}. Hope the set came together. If
        anything wasn&apos;t right — gear, sound, the space — just reply and
        tell us; we read every message and we&apos;d rather know.
      </EmailText>

      <InfoBlock label="Off-peak tip">
        Weekday daytimes (Mon–Fri, 10am–4pm) are the quietest time to really dig
        in — and two hours then is just $60+GST. Same room, same gear, waiting.
      </InfoBlock>

      <EmailButton href={bookUrl}>Book another session</EmailButton>
    </EmailLayout>
  );
}
