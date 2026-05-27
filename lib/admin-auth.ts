import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Server-side admin gate. Redirects to login if the session isn't the admin. */
export async function requireAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (adminEmail && user.email?.toLowerCase() !== adminEmail)) {
    redirect("/admin/login");
  }
  return user;
}

/** Boolean variant for server actions (throws on failure). */
export async function assertAdmin() {
  await requireAdmin();
}
