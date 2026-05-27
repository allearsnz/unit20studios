"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarOff, LayoutList, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Bookings", href: "/admin", icon: LayoutList, exact: true },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Blackouts", href: "/admin/blackouts", icon: CalendarOff },
  { label: "Quick book", href: "/admin/quick-book", icon: Zap },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-sm px-3 py-2.5 font-mono text-xs uppercase tracking-meta transition-colors",
              active ? "bg-bg-elev text-accent" : "text-text-muted hover:bg-bg-elev hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
