import { Check } from "lucide-react";
import { VerifyCustomerButton } from "./VerifyCustomerButton";
import { ResendIdVerificationButton } from "./ResendIdVerificationButton";
import { formatNZ } from "@/lib/timezone";
import type { VerificationView } from "@/lib/id-verification";

const DOC_LABEL: Record<string, string> = {
  drivers_licence: "Driver licence",
  passport: "Passport",
};

/**
 * The ID check, as the admin sees it: what they sent, big enough to read, and
 * the one button that matters. Shown on both the booking and the customer page,
 * because that's where the question actually gets asked.
 *
 * Images come through five-minute signed URLs — the bucket is private, so a
 * screenshot of this page is not a permanent link to someone's licence.
 */
export function IdVerificationPanel({
  customerId,
  view,
  verifiedAt,
}: {
  customerId: string;
  view: VerificationView;
  verifiedAt?: string | null;
}) {
  if (view.state === "verified") {
    return (
      <div>
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-meta text-accent">
          <Check className="h-4 w-4" aria-hidden /> ID verified
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {verifiedAt ? `Approved ${formatNZ(verifiedAt, "d MMM yyyy")}. ` : ""}
          Documents were deleted on approval — every future booking of theirs
          confirms straight away.
        </p>
      </div>
    );
  }

  return (
    <div>
      {view.state === "submitted" ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-meta text-accent">
              Uploaded — needs a look
            </p>
            <p className="font-mono text-[11px] uppercase tracking-meta text-text-muted">
              {view.verification?.doc_type ? DOC_LABEL[view.verification.doc_type] : "Document"}
              {view.verification?.submitted_at
                ? ` · ${formatNZ(view.verification.submitted_at, "d MMM, HH:mm")}`
                : ""}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DocumentTile label="Front" url={view.front} />
            <DocumentTile label="Back" url={view.back} />
          </div>

          <p className="mt-3 text-xs text-text-dim">
            Links expire in 5 minutes — reload the page for fresh ones.
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">
          {view.state === "awaiting"
            ? `Link sent${
                view.verification?.sent_at
                  ? ` ${formatNZ(view.verification.sent_at, "d MMM yyyy")}`
                  : ""
              }${
                (view.verification?.send_count ?? 0) > 1
                  ? ` · ${view.verification?.send_count} times`
                  : ""
              } — nothing uploaded yet.`
            : "No ID on file and no link sent yet."}
        </p>
      )}

      <div className="mt-5 space-y-2 border-t border-border pt-4">
        <VerifyCustomerButton customerId={customerId} verified={false} />
        <ResendIdVerificationButton
          customerId={customerId}
          label={view.state === "none" ? "Send ID link" : "Resend ID link"}
        />
        {view.state === "submitted" ? (
          <p className="text-center text-xs text-text-dim">
            Approving deletes both images.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DocumentTile({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="flex aspect-[3/2] items-center justify-center border border-dashed border-border bg-bg-elev">
        <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">
          No {label.toLowerCase()}
        </span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-[3/2] overflow-hidden border border-border bg-bg-elev"
    >
      {/* Not next/image: these are private signed URLs on a rotating path, so
          the optimiser would only cache something we want short-lived. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${label} of the customer's ID document`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <span className="absolute bottom-0 left-0 bg-bg/80 px-2 py-1 font-mono text-[11px] uppercase tracking-meta text-text">
        {label} · open
      </span>
    </a>
  );
}
