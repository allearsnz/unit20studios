import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { IdUploadForm } from "@/components/verify/IdUploadForm";
import { verificationByToken } from "@/lib/id-verification";

// The token is the credential — never let it near a search index or a cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your ID",
  robots: { index: false, follow: false },
};

export default async function VerifyIdPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let lookup: Awaited<ReturnType<typeof verificationByToken>>;
  try {
    lookup = await verificationByToken(token);
  } catch {
    lookup = { ok: false, reason: "not_found" };
  }

  if (!lookup.ok) {
    return (
      <Section className="pt-32 md:pt-40">
        <p className="eyebrow mb-3">Studio · ID check</p>
        <h1 className="h1 text-text">
          {lookup.reason === "expired" ? "That link has expired." : "That link isn't valid."}
        </h1>
        <p className="lead mt-6 max-w-lg">
          {lookup.reason === "expired"
            ? "Verification links only stay live for a while, so an old one stops working. Reply to the email we sent you and we'll send a fresh link."
            : "It may have already been used, or been replaced by a newer one. Check for a more recent email from us, or reply to it and we'll sort you out."}
        </p>
        <a href="mailto:studio@unit20.nz" className="btn btn-secondary mt-8">
          Email the studio
        </a>
      </Section>
    );
  }

  const { verification, customer } = lookup;
  const firstName = customer.name.split(/\s+/)[0] || "there";

  return (
    <Section className="pt-32 md:pt-40">
      <div className="max-w-xl">
        <p className="eyebrow mb-3">Studio · ID check</p>
        <h1 className="h1 text-text">
          {verification.submitted_at ? "Got it." : `Verify your ID, ${firstName}.`}
        </h1>

        {verification.submitted_at ? (
          <>
            <p className="lead mt-6">
              Your ID is with us and we&apos;ll check it shortly — you&apos;ll
              get an email once your booking is confirmed. Nothing else to do.
            </p>
            <p className="mt-6 text-sm text-text-muted">
              Uploaded the wrong thing? Send it again below and we&apos;ll use
              the newer one.
            </p>
          </>
        ) : (
          <p className="lead mt-6">
            A one-off check before your first session. Upload the{" "}
            <strong className="text-text">front and back</strong> of your driver
            licence, or the photo page of your passport. A clear phone photo is
            fine.
          </p>
        )}

        <IdUploadForm token={token} resubmitting={!!verification.submitted_at} />

        <p className="mt-10 border-t border-border pt-6 text-sm text-text-muted">
          Your documents are stored privately, are only ever seen by us, and are
          deleted as soon as your ID is approved. We use them for the age and
          identity check and nothing else.
        </p>
      </div>
    </Section>
  );
}
