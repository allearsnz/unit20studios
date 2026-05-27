import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components/EmailLayout";

export type BookingPostSessionProps = {
  firstName: string;
  bookUrl: string;
};

export default function BookingPostSession({
  firstName = "there",
  bookUrl = "https://unit20.nz/studio/book",
}: BookingPostSessionProps) {
  return (
    <EmailLayout preview="How was the session?">
      <EmailHeading>How&apos;d it go?</EmailHeading>
      <EmailText>
        Thanks for using the room, {firstName}. Hope the set came together. If
        anything wasn&apos;t right — gear, sound, the space — just reply and tell
        us; we read every message and we&apos;d rather know.
      </EmailText>
      <EmailText>
        When you&apos;re ready for the next one, off-peak hours (weekday daytime)
        are the quietest time to really dig in. Same room, same gear, waiting.
      </EmailText>

      <EmailButton href={bookUrl}>Book another session</EmailButton>
    </EmailLayout>
  );
}
