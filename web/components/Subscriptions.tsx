"use client";
import { motion } from "motion/react";
import { fmtUSD } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function Subscriptions({ transactions }: { transactions: Transaction[] }) {
  const subs = new Map<string, { amount: number; count: number; last: string; merchants: Set<string> }>();
  for (const t of transactions) {
    if (!t.category.startsWith("subscription:") || t.amount === null) continue;
    const key = t.category.replace("subscription:", "");
    const cur = subs.get(key) || { amount: 0, count: 0, last: "", merchants: new Set<string>() };
    cur.amount += Math.abs(t.amount);
    cur.count += 1;
    if (t.date > cur.last) cur.last = t.date;
    cur.merchants.add(t.description.split(" ").slice(0, 3).join(" "));
    subs.set(key, cur);
  }

  const sorted = Array.from(subs.entries()).sort((a, b) => b[1].amount - a[1].amount);

  if (sorted.length === 0) {
    return (
      <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] p-8 text-center font-display italic text-[color:var(--color-ink-mute)]">
        No standing orders detected.
      </div>
    );
  }

  const total = sorted.reduce((a, [, v]) => a + v.amount, 0);

  return (
    <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-gold-deep)]">
          {sorted.length} active
        </span>
        <span className="font-mono-tab text-base text-[color:var(--color-ink)]">
          {fmtUSD(total)} <span className="font-display italic text-sm text-[color:var(--color-ink-mute)]">total in window</span>
        </span>
      </div>
      <div className="space-y-2">
        {sorted.map(([k, v], i) => {
          const pct = (v.amount / total) * 100;
          return (
            <motion.div
              key={k}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_18%,transparent)] bg-[color:var(--color-parch)] px-4 py-3 transition-colors hover:bg-[color:var(--color-parch-warm)]"
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)] to-transparent"
                style={{ width: `${pct * 1.5}%` }}
              />
              <div className="relative flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-display text-lg italic text-[color:var(--color-ink)] capitalize">{k}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-ink-mute)]">
                    {v.count} charges &middot; last {v.last}
                  </div>
                </div>
                <div className="font-mono-tab text-base text-[color:var(--color-ink)]">{fmtUSD(v.amount)}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
