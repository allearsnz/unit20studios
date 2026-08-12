import { LogOut } from "lucide-react";
import { signOutAdmin } from "@/app/admin/actions";

/**
 * A server component — no `"use client"`, and that is the point.
 *
 * This was a client component calling `supabase.auth.signOut()` in the browser,
 * which pulled `@supabase/supabase-js` (~61KB gzipped) into the admin client
 * bundle. It sits in `AdminShell`, i.e. the layout, so that import was on the
 * hydration path of every single admin page — and Next can't prefetch anything
 * until hydration finishes, which made the first click after each page load the
 * slowest one.
 *
 * A form posting to a server action needs no JavaScript at all, and signing out
 * on the server clears the cookie itself rather than clearing it in the browser
 * and then asking the server to catch up.
 */
export function SignOutButton() {
  return (
    <form action={signOutAdmin}>
      <button
        type="submit"
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-text-muted transition-colors hover:text-text"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </button>
    </form>
  );
}
