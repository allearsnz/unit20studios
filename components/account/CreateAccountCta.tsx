import Link from "next/link";
import { ArrowRight, Clock, Gift, Wallet } from "lucide-react";
import { MILESTONE_HOURS, REWARD_PERCENT } from "@/lib/rewards";

/**
 * The nudge that was missing.
 *
 * Accounts, banked hours and play-time rewards have all worked for a while, and
 * nobody signed up — because nothing ever mentioned them. This is the moment to
 * ask: they have just booked, they are already looking at a page about their
 * session, and the account is worth something to them specifically because they
 * now have an hour of play time to their name.
 *
 * NO EMAIL IN THE QUERY STRING. It would be a nicer prefill, and it would also
 * put a customer's address into a URL that lands in server logs, browser history
 * and any `Referer` header the signup page emits. The sign-up form says to use
 * the same address, and `resolveLinkedCustomer` matches on the verified email
 * anyway, so the history connects itself.
 */
export function CreateAccountCta({
  /** Shown when we know this booking earned them time. */
  hoursBooked,
}: {
  hoursBooked?: number;
}) {
  return (
    <section className="card mt-12 p-6 md:p-8">
      <p className="eyebrow mb-3">Your account</p>
      <h2 className="h3 text-text">
        {hoursBooked
          ? `Keep track of these ${hoursBooked} hours.`
          : "Keep track of your hours."}
      </h2>
      <p className="lead mt-3 max-w-md text-sm">
        Set up an account and every session you book shows up in one place — no
        digging through emails to find a reference.
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        <Perk icon={Clock} title="Play time">
          Hours in the booth, totted up.
        </Perk>
        <Perk icon={Gift} title="Rewards">
          Every {MILESTONE_HOURS} hours earns {REWARD_PERCENT}% off a session.
        </Perk>
        <Perk icon={Wallet} title="Banked hours">
          Your balance, if you&apos;re on a pack.
        </Perk>
      </ul>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/account/signup" className="btn btn-primary">
          Create your account
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/account/login"
          className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4 hover:text-text"
        >
          I already have one
        </Link>
      </div>

      <p className="mt-5 text-sm text-text-dim">
        Use the same email you booked with and this session — plus anything
        you&apos;ve booked before — connects to it automatically.
      </p>
    </section>
  );
}

function Perk({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Icon className="h-4 w-4 text-accent" aria-hidden />
      <p className="mt-2 font-mono text-[11px] uppercase tracking-meta text-text">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{children}</p>
    </li>
  );
}
