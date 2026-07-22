import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/* ------------------------------------------------------------------ *
 * Unit 20 — email design system
 * Mirrors app/globals.css / design-system/MASTER.md brand tokens,
 * flattened to email-safe solid hex (no rgba hairlines in Outlook).
 * ------------------------------------------------------------------ */
export const c = {
  bg: "#0a0a0a", // page — off-black
  panel: "#141414", // raised surfaces
  panel2: "#1f1f1f", // cards
  text: "#f5f1ea", // warm off-white
  muted: "#8a8580",
  dim: "#5c5856",
  accent: "#3ddc97", // washed sea green
  border: "#262624", // hairline (solid equiv of rgba(245,241,234,.08) on #0a0a0a)
  borderStrong: "#3a3833",
  danger: "#e5484d",
};

/**
 * Brand mono. PP Supply Mono is referenced by name only — the licensed font
 * file is never embedded — so it renders wherever installed and degrades
 * gracefully to a system mono everywhere else. No images anywhere.
 */
export const mono =
  "'PP Supply Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
export const sans =
  "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Small mono uppercase label — the site's `.eyebrow` pattern. */
const eyebrowStyle: React.CSSProperties = {
  fontFamily: mono,
  fontSize: "11px",
  lineHeight: "1.4",
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: c.accent,
  margin: "0 0 12px",
};

/** Text wordmark — matches the site logo's lowercase `unit/20` (slash in accent). */
export function Wordmark() {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: "20px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: c.text,
      }}
    >
      unit<span style={{ color: c.accent }}>/</span>20
    </span>
  );
}

export function EmailLayout({
  preview,
  eyebrow,
  children,
}: {
  preview: string;
  /** Mono uppercase kicker above the heading, e.g. "Booking / Confirmed". */
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: c.bg,
          margin: 0,
          padding: 0,
          color: c.text,
          fontFamily: sans,
        }}
      >
        <Container
          style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 24px 48px" }}
        >
          {/* Masthead — text wordmark left, locality meta right */}
          <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: "collapse" }}
          >
            <tbody>
              <tr>
                <td style={{ verticalAlign: "baseline" }}>
                  <Wordmark />
                </td>
                <td
                  align="right"
                  style={{
                    verticalAlign: "baseline",
                    fontFamily: mono,
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: c.dim,
                  }}
                >
                  Christchurch&nbsp;&middot;&nbsp;NZ
                </td>
              </tr>
            </tbody>
          </table>

          {/* Rule — short accent tick bleeding into a hairline */}
          <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: "collapse", margin: "18px 0 36px" }}
          >
            <tbody>
              <tr>
                <td
                  width={28}
                  style={{
                    height: "2px",
                    backgroundColor: c.accent,
                    fontSize: "0",
                    lineHeight: "0",
                  }}
                >
                  &nbsp;
                </td>
                <td
                  style={{
                    height: "2px",
                    backgroundColor: c.border,
                    fontSize: "0",
                    lineHeight: "0",
                  }}
                >
                  &nbsp;
                </td>
              </tr>
            </tbody>
          </table>

          {eyebrow ? <Text style={eyebrowStyle}>{eyebrow}</Text> : null}

          {children}

          {/* Footer */}
          <table
            width="100%"
            cellPadding={0}
            cellSpacing={0}
            style={{ borderCollapse: "collapse", margin: "44px 0 16px" }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    height: "1px",
                    backgroundColor: c.border,
                    fontSize: "0",
                    lineHeight: "0",
                  }}
                >
                  &nbsp;
                </td>
              </tr>
            </tbody>
          </table>
          <Text
            style={{
              fontFamily: mono,
              fontSize: "11px",
              lineHeight: "1.9",
              color: c.muted,
              margin: 0,
            }}
          >
            unit/20 &mdash; 20 Southwark Street, Christchurch Central 8011
            <br />
            <Link
              href="https://studio.unit20.nz"
              style={{ color: c.muted, textDecoration: "underline" }}
            >
              studio.unit20.nz
            </Link>
            &nbsp;&middot;&nbsp;
            <Link
              href="mailto:studio@unit20.nz"
              style={{ color: c.muted, textDecoration: "underline" }}
            >
              studio@unit20.nz
            </Link>
            &nbsp;&middot;&nbsp;
            <Link
              href="https://instagram.com/unit20.nz"
              style={{ color: c.muted, textDecoration: "underline" }}
            >
              @unit20.nz
            </Link>
            <br />
            <span style={{ color: c.dim }}>
              -43.5365, 172.6336 &middot; DJ practice studio &middot; gear hire
            </span>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Big display heading — brand mono, like the site's `.h1`. */
export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: mono,
        fontSize: "27px",
        lineHeight: "1.2",
        fontWeight: 700,
        color: c.text,
        letterSpacing: "-0.01em",
        margin: "0 0 18px",
      }}
    >
      {children}
    </Text>
  );
}

export function EmailText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: sans,
        fontSize: "15px",
        lineHeight: "1.65",
        color: c.muted,
        margin: "0 0 18px",
      }}
    >
      {children}
    </Text>
  );
}

/** Bordered details panel — mono label / value rows with hairline dividers. */
export function DetailPanel({
  rows,
}: {
  rows: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <Section
      style={{
        border: `1px solid ${c.border}`,
        borderTop: `2px solid ${c.accent}`,
        backgroundColor: c.panel,
        padding: "6px 20px",
        margin: "10px 0 28px",
      }}
    >
      {rows.map((r, i) => (
        <table
          key={i}
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  padding: "13px 12px 13px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                  fontFamily: mono,
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  color: c.muted,
                  whiteSpace: "nowrap",
                  verticalAlign: "top",
                }}
              >
                {r.label}
              </td>
              <td
                style={{
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${c.border}`,
                  textAlign: "right",
                  fontFamily: mono,
                  fontSize: "13px",
                  lineHeight: "1.5",
                  color: r.accent ? c.accent : c.text,
                }}
              >
                {r.value}
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </Section>
  );
}

/** Accent-edged callout — mono label over short body copy ("Getting in", etc.). */
export function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Section
      style={{
        borderLeft: `2px solid ${c.accent}`,
        paddingLeft: "18px",
        margin: "0 0 24px",
      }}
    >
      <Text
        style={{
          fontFamily: mono,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: c.text,
          margin: "0 0 6px",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: sans,
          fontSize: "14px",
          lineHeight: "1.65",
          color: c.muted,
          margin: 0,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

/** Primary CTA — accent fill, dark mono uppercase label, 4px corners. */
export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Section style={{ margin: "4px 0 8px" }}>
      <Link
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: c.accent,
          color: c.bg,
          fontFamily: mono,
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontWeight: 700,
          padding: "14px 26px",
          borderRadius: "4px",
          textDecoration: "none",
        }}
      >
        {children}&nbsp;&nbsp;&rarr;
      </Link>
    </Section>
  );
}
