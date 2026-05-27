import type { ReactElement } from "react";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL ?? "studio@unit20.nz";
const REPLY_TO = process.env.RESEND_REPLY_TO ?? FROM;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

const resend = apiKey ? new Resend(apiKey) : null;

export type EmailAttachment = { filename: string; content: string };

type SendArgs = {
  to: string | string[];
  subject: string;
  react?: ReactElement;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
};

export type SendResult = { ok: boolean; id?: string; error?: string };

/**
 * Send via Resend. Never throws — booking/contact creation must not be blocked
 * by an email failure. Logs full context on error so a human can resend from
 * the admin booking detail page. In dev without RESEND_API_KEY, it no-ops.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${args.subject}" → ${args.to}`);
    return { ok: false, error: "email_not_configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: `Unit 20 <${FROM}>`,
      to: args.to,
      subject: args.subject,
      replyTo: args.replyTo ?? REPLY_TO,
      ...(args.react ? { react: args.react } : {}),
      ...(args.text ? { text: args.text } : {}),
      ...(args.attachments ? { attachments: args.attachments } : {}),
    } as Parameters<typeof resend.emails.send>[0]);

    if (error) {
      console.error("[email] send failed", { subject: args.subject, to: args.to, error });
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email] threw", { subject: args.subject, to: args.to, err });
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** Plain-text admin notification. No-ops if ADMIN_EMAIL is unset. */
export async function notifyAdmin(subject: string, text: string): Promise<SendResult> {
  if (!ADMIN_EMAIL) {
    console.warn(`[email] ADMIN_EMAIL not set — skipped admin notify "${subject}"`);
    return { ok: false, error: "admin_email_not_configured" };
  }
  return sendEmail({ to: ADMIN_EMAIL, subject, text });
}

export function icsAttachment(filename: string, ics: string): EmailAttachment {
  return { filename, content: Buffer.from(ics, "utf-8").toString("base64") };
}
