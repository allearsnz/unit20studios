import Link from "next/link";
import { Check, ShieldAlert } from "lucide-react";
import { IdVerificationPanel } from "./IdVerificationPanel";
import { formatNZPhone } from "@/lib/validation";
import type { VerificationView } from "@/lib/id-verification";
import type { Customer } from "@/lib/types";

/**
 * Who they are and whether we've checked their ID, in one card.
 *
 * These were two tabs, and that was one tab too many: the question an admin
 * opens a booking with is "who is this and are they cleared to come in?", and
 * splitting the answer across two server round trips made it a two-step
 * question. The ID state is also the one thing here that can be *wrong*, so it
 * belongs next to the name rather than behind it.
 */
export function CustomerCard({
  customer,
  view,
}: {
  customer: Customer;
  view: VerificationView;
}) {
  const verified = view.state === "verified";

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="eyebrow mb-3">Customer</h2>
          <Link
            href={`/admin/customers/${customer.id}`}
            className="font-display text-h3 font-semibold text-text hover:text-accent"
          >
            {customer.name}
          </Link>
          <p className="mt-1 break-words text-sm text-text-muted">{customer.email}</p>
          <p className="mono text-sm text-text-muted">{formatNZPhone(customer.phone)}</p>
        </div>
        {/* The verdict, readable without scrolling to the section that explains it. */}
        <span
          className={
            verified
              ? "inline-flex shrink-0 items-center gap-1.5 border border-accent/40 px-2.5 py-1 font-mono text-[11px] uppercase tracking-meta text-accent"
              : "inline-flex shrink-0 items-center gap-1.5 border border-amber-400/40 px-2.5 py-1 font-mono text-[11px] uppercase tracking-meta text-amber-400"
          }
        >
          {verified ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> ID ok
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> No ID
            </>
          )}
        </span>
      </div>

      <dl className="mt-5 border-t border-border pt-1">
        <Row label="DOB" value={customer.dob} />
        <Row label="Marketing" value={customer.marketing_opt_in ? "Opted in" : "No"} />
      </dl>

      {/* `id-check` is the anchor the automation panel's "send it from here"
          link points at, now that there's no ID tab to navigate to. */}
      <div id="id-check" className="mt-5 scroll-mt-24 border-t border-border pt-5">
        <h3 className="eyebrow mb-4">ID verification</h3>
        <IdVerificationPanel
          customerId={customer.id}
          view={view}
          verifiedAt={customer.id_verified_at}
        />
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 first:border-t-0">
      <dt className="font-mono text-[11px] uppercase tracking-meta text-text-muted">{label}</dt>
      <dd className="text-right text-sm text-text">{value}</dd>
    </div>
  );
}
