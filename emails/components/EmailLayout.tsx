import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export const c = {
  bg: "#0f0f0f",
  panel: "#161616",
  text: "#f5f1ea",
  muted: "#8a8580",
  dim: "#5c5856",
  accent: "#3ddc97",
  border: "#2a2a2a",
};

const mono =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const sans = 'Inter, -apple-system, "Segoe UI", Arial, sans-serif';
const serif = 'Georgia, "Times New Roman", serif';

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: c.bg, margin: 0, padding: 0, color: c.text, fontFamily: sans }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 24px 40px" }}>
          <Section>
            <Text style={{ fontFamily: mono, fontSize: "13px", letterSpacing: "2px", textTransform: "uppercase", color: c.text, margin: "0 0 28px" }}>
              <span style={{ color: c.accent }}>■</span>&nbsp;&nbsp;Unit 20
            </Text>
          </Section>

          {children}

          <Hr style={{ borderColor: c.border, borderTop: `1px solid ${c.border}`, margin: "36px 0 16px" }} />
          <Text style={{ fontFamily: mono, fontSize: "11px", lineHeight: "1.7", color: c.muted, margin: 0 }}>
            Unit 20 · 20 Southwark Street, Christchurch
            <br />
            <Link href="https://unit20.nz" style={{ color: c.muted, textDecoration: "underline" }}>
              unit20.nz
            </Link>
            &nbsp;·&nbsp;
            <Link href="mailto:studio@unit20.nz" style={{ color: c.muted, textDecoration: "underline" }}>
              studio@unit20.nz
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: serif, fontSize: "30px", lineHeight: "1.1", fontWeight: 600, color: c.text, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
      {children}
    </Text>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: sans, fontSize: "15px", lineHeight: "1.6", color: c.muted, margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

/** Bordered details panel with mono label / value rows. */
export function DetailPanel({ rows }: { rows: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <Section style={{ border: `1px solid ${c.border}`, borderRadius: "4px", backgroundColor: c.panel, padding: "8px 20px", margin: "8px 0 24px" }}>
      {rows.map((r, i) => (
        <table key={i} width="100%" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, fontFamily: mono, fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: c.muted }}>
                {r.label}
              </td>
              <td style={{ padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${c.border}`, textAlign: "right", fontFamily: mono, fontSize: "14px", color: r.accent ? c.accent : c.text }}>
                {r.value}
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </Section>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{ display: "inline-block", backgroundColor: c.accent, color: c.bg, fontFamily: mono, fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, padding: "13px 22px", borderRadius: "4px", textDecoration: "none" }}
    >
      {children}
    </Link>
  );
}
