import { createElement } from "react";
import { type NextRequest, NextResponse } from "next/server";
import { contactInputSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAIL, sendEmail } from "@/lib/email";
import ContactForm from "@/emails/ContactForm";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimit(`contact:${ip}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "That's a few messages already — try again in a little while." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parsed = contactInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form and try again.", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // honeypot: a filled "company" field means a bot — accept silently, do nothing
  if (input.company) return NextResponse.json({ ok: true });

  try {
    const supabase = createAdminClient();
    await supabase.from("contact_submissions").insert({
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      subject: input.subject,
      message: input.message,
      source_page: input.sourcePage ?? null,
      ip_address: ip,
    });
  } catch (e) {
    console.error("[contact] insert failed (continuing)", e);
  }

  try {
    await sendEmail({
      to: ADMIN_EMAIL || process.env.RESEND_REPLY_TO || "studio@unit20.nz",
      replyTo: input.email,
      subject: `Contact — ${input.subject} — ${input.name}`,
      react: createElement(ContactForm, {
        name: input.name,
        email: input.email,
        phone: input.phone,
        subject: input.subject,
        message: input.message,
        sourcePage: input.sourcePage ?? undefined,
      }),
    });
  } catch (e) {
    console.error("[contact] email failed", e);
  }

  return NextResponse.json({ ok: true });
}
