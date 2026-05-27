import { cn } from "@/lib/utils";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

const STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  pending_verification: { label: "Pending", cls: "border-amber-500/40 text-amber-400" },
  confirmed: { label: "Confirmed", cls: "border-accent/50 text-accent" },
  completed: { label: "Completed", cls: "border-border-strong text-text-muted" },
  cancelled: { label: "Cancelled", cls: "border-danger/40 text-danger" },
  no_show: { label: "No-show", cls: "border-danger/40 text-danger" },
};

const PAYMENT: Record<PaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: "Unpaid", cls: "border-border-strong text-text-muted" },
  paid: { label: "Paid", cls: "border-accent/50 text-accent" },
  refunded: { label: "Refunded", cls: "border-border-strong text-text-dim" },
  comped: { label: "Comped", cls: "border-accent/30 text-accent/80" },
};

function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] uppercase tracking-meta",
        cls,
      )}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS[status] ?? STATUS.pending_verification;
  return <Pill label={s.label} cls={s.cls} />;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const p = PAYMENT[status] ?? PAYMENT.unpaid;
  return <Pill label={p.label} cls={p.cls} />;
}
