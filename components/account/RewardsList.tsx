import Link from "next/link";
import { formatNZ } from "@/lib/timezone";
import type { DiscountCode } from "@/lib/types";

/** Active reward codes on the account, each with a one-tap book-with-code link. */
export function RewardsList({ rewards }: { rewards: DiscountCode[] }) {
  return (
    <div className="card p-6">
      <p className="eyebrow">Your rewards</p>

      {rewards.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          No active rewards yet. Every 10 hours of play earns a 50% code for a standard
          session.
        </p>
      ) : (
        <ul className="mt-4">
          {rewards.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-4 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="mono truncate text-lg text-accent">{r.code}</p>
                <p className="mt-1 font-mono text-meta uppercase tracking-meta text-text-muted">
                  {r.percent}% off · standard rates
                  {r.expires_at ? ` · expires ${formatNZ(r.expires_at, "d MMM yyyy")}` : ""}
                </p>
              </div>
              <Link
                href={`/studio/book?code=${encodeURIComponent(r.code)}`}
                className="btn btn-secondary h-9 shrink-0 px-4 font-mono text-xs uppercase tracking-meta"
              >
                Use it
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 font-mono text-[11px] uppercase tracking-meta text-text-dim">
        Reward codes apply to standard sessions — not the 10-hour pack.
      </p>
    </div>
  );
}
