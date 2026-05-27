import Link from "next/link";
import { Check } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatNZ } from "@/lib/timezone";
import { formatNZPhone } from "@/lib/validation";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

type CustomerRow = Customer & { bookings: { count: number }[] };

export default async function CustomersPage() {
  let customers: CustomerRow[] = [];
  let configured = true;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("customers")
      .select("*, bookings:bookings(count)")
      .order("created_at", { ascending: false })
      .limit(500);
    customers = (data as CustomerRow[]) ?? [];
  } catch {
    configured = false;
  }

  return (
    <div className="p-5 md:p-10">
      <h1 className="h2 text-text">Customers</h1>

      {!configured ? (
        <Notice>Connect Supabase to load customers.</Notice>
      ) : customers.length === 0 ? (
        <Notice>No customers yet — they appear here after the first booking.</Notice>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-meta text-text-muted">
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Email</th>
                <th className="py-3 pr-4 font-medium">Phone</th>
                <th className="py-3 pr-4 font-medium">ID</th>
                <th className="py-3 pr-4 text-right font-medium">Bookings</th>
                <th className="py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="group border-b border-border transition-colors hover:bg-bg-elev">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/customers/${c.id}`} className="text-text group-hover:text-accent">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-text-muted">{c.email}</td>
                  <td className="py-3 pr-4 mono text-text-muted">{formatNZPhone(c.phone)}</td>
                  <td className="py-3 pr-4">
                    {c.id_verified ? (
                      <Check className="h-4 w-4 text-accent" aria-label="ID verified" />
                    ) : (
                      <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">No</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right mono text-text">{c.bookings?.[0]?.count ?? 0}</td>
                  <td className="py-3 mono text-text-muted">{formatNZ(c.created_at, "d MMM yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 border border-dashed border-border bg-bg-elev/40 px-6 py-16 text-center">
      <p className="lead">{children}</p>
    </div>
  );
}
