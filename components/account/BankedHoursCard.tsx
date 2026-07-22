import Link from "next/link";

/**
 * Prepaid banked-hours balance (from the 10-hour pack). Only rendered when the
 * customer has ever had a ledger entry — a plain cash-only customer never sees
 * it. Shows the current balance and a book-with-hours CTA.
 */
export function BankedHoursCard({ balance }: { balance: number }) {
  return (
    <div className="card p-6">
      <p className="eyebrow">Banked hours</p>
      <p className="mono mt-4 text-3xl text-text">
        {balance}
        <span className="ml-2 font-sans text-meta uppercase tracking-meta text-text-muted">
          hrs left
        </span>
      </p>
      <p className="mt-3 font-mono text-meta uppercase tracking-meta text-text-dim">
        Prepaid · use on any session
      </p>
      {balance > 0 ? (
        <Link href="/studio/book" className="btn btn-secondary mt-6 h-10 w-full font-mono text-xs uppercase tracking-meta">
          Book with banked hours
        </Link>
      ) : (
        <p className="mt-5 text-sm text-text-muted">
          Buy the 10-hour pack when you book and your hours bank here — draw them down
          whenever you like.
        </p>
      )}
    </div>
  );
}
