"use client";
import Link from "next/link";
import { motion } from "motion/react";

export default function Nav() {
  return (
    <header className="relative z-20 border-b border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)]">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-5 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <motion.div
            initial={{ opacity: 0, rotate: -15 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ duration: 0.6 }}
            className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--color-gold)] bg-[color:var(--color-parch-light)] font-display text-xl text-[color:var(--color-gold-deep)]"
          >
            M&middot;M
          </motion.div>
          <div>
            <div className="font-display text-lg leading-none text-[color:var(--color-ink)]">
              Wealth <em className="font-semibold text-[color:var(--color-gold-deep)]">Ledger</em>
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-ink-mute)]">
              Private statement of accounts
            </div>
          </div>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "/", label: "Overview" },
            { href: "/trace", label: "Money Trace" },
            { href: "/people", label: "People" },
            { href: "/ledger", label: "Ledger" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--color-gold)_10%,transparent)] hover:text-[color:var(--color-ink)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
