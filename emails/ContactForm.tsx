import {
  DetailPanel,
  EmailHeading,
  EmailLayout,
  EmailText,
} from "./components/EmailLayout";

export type ContactEmailProps = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  sourcePage?: string;
};

export default function ContactForm({
  name = "Jane Doe",
  email = "jane@example.com",
  phone,
  subject = "Studio",
  message = "Hi, I'd like to book the studio…",
  sourcePage,
}: ContactEmailProps) {
  return (
    <EmailLayout preview={`Contact — ${subject} — ${name}`}>
      <EmailHeading>New enquiry</EmailHeading>
      <EmailText>Someone got in touch via the website.</EmailText>

      <DetailPanel
        rows={[
          { label: "Name", value: name },
          { label: "Email", value: email },
          ...(phone ? [{ label: "Phone", value: phone }] : []),
          { label: "Subject", value: subject, accent: true },
          ...(sourcePage ? [{ label: "From page", value: sourcePage }] : []),
        ]}
      />

      <EmailText>{message}</EmailText>
    </EmailLayout>
  );
}
