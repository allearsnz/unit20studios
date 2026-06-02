import Link from "next/link";
import { AdminNav } from "./AdminNav";
import { SignOutButton } from "./SignOutButton";
import { Wordmark } from "@/components/layout/Wordmark";

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-border bg-bg p-5 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <Link href="/admin" className="flex items-center gap-3">
          <Wordmark className="w-[88px]" />
          <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">
            Admin
          </span>
        </Link>

        <AdminNav />

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="min-w-0 truncate font-mono text-[11px] text-text-dim">{email}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
