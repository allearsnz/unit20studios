"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { primaryNav, type NavLink } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function DesktopLink({ item }: { item: NavLink }) {
    if (item.external) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="link inline-flex items-center gap-1 font-mono text-xs uppercase tracking-meta text-text-muted transition-colors hover:text-text"
        >
          {item.label}
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </a>
      );
    }
    return (
      <Link
        href={item.href}
        aria-current={isActive(item.href) ? "page" : undefined}
        className={cn(
          "link font-mono text-xs uppercase tracking-meta transition-colors",
          isActive(item.href) ? "text-text" : "text-text-muted hover:text-text",
        )}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        scrolled ? "border-border bg-bg/80 backdrop-blur-md" : "border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center justify-between md:h-20">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Unit 20 — home">
          <span
            className="block h-2 w-2 bg-accent transition-transform duration-300 group-hover:rotate-45"
            aria-hidden
          />
          <span className="font-mono text-sm font-medium uppercase tracking-meta text-text">
            Unit 20
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {primaryNav.map((item) => (
            <DesktopLink key={item.href} item={item} />
          ))}
          <Link
            href="/studio/book"
            className="btn btn-primary h-10 px-5 font-mono text-xs uppercase tracking-meta"
          >
            Book a session
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-mr-2 flex h-10 w-10 items-center justify-center text-text md:hidden"
        >
          <Menu className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col bg-bg md:hidden"
          >
            <div className="container-page flex h-16 items-center justify-between">
              <span className="font-mono text-sm font-medium uppercase tracking-meta">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-2 flex h-10 w-10 items-center justify-center text-text"
              >
                <X className="h-6 w-6" strokeWidth={1.5} />
              </button>
            </div>

            <nav
              className="container-page flex flex-1 flex-col justify-center gap-1 pb-24"
              aria-label="Primary mobile"
            >
              {primaryNav.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i + 0.05, duration: 0.4 }}
                >
                  {item.external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="h2 inline-flex items-center gap-2 py-2 text-text"
                    >
                      {item.label}
                      <ArrowUpRight className="h-5 w-5 text-text-muted" aria-hidden />
                    </a>
                  ) : (
                    <Link href={item.href} className="h2 block py-2 text-text hover:text-accent">
                      {item.label}
                    </Link>
                  )}
                </motion.div>
              ))}
              <Link
                href="/studio/book"
                className="btn btn-primary mt-8 w-full font-mono text-sm uppercase tracking-meta"
              >
                Book a session
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
