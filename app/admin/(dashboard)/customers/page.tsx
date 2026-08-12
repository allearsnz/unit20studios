import { createAdminClient } from "@/lib/supabase/admin";
// The grid constant comes from a plain module, not from the client component
// that also uses it — see customerRowGrid.ts.
import { CustomerRowLink } from "@/components/admin/CustomerRowLink";
import { CUSTOMER_GRID } from "@/components/admin/customerRowGrid";
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
        <div className="mt-8">
          {/* Rows are links that restack on phones — see CustomerRowLink. This
              was a min-w-[720px] table in an overflow container. */}
          <div
            className={`${CUSTOMER_GRID} hidden border-b border-border py-3 font-mono text-[11px] uppercase tracking-meta text-text-muted md:grid`}
          >
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>ID</span>
            <span className="text-right">Bookings</span>
            <span>Joined</span>
          </div>

          {customers.map((c) => (
            <CustomerRowLink
              key={c.id}
              href={`/admin/customers/${c.id}`}
              name={c.name}
              email={c.email}
              phone={formatNZPhone(c.phone)}
              verified={c.id_verified}
              bookings={c.bookings?.[0]?.count ?? 0}
              joined={formatNZ(c.created_at, "d MMM yyyy")}
            />
          ))}
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
