"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Anomaly } from "@/lib/types";
import { fmtUSD, shortDate } from "@/lib/format";
import { AlertTriangle, Check, X } from "lucide-react";

export default function Anomalies({ anomalies }: { anomalies: Anomaly[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = anomalies.filter((_, i) => !dismissed.has(i));

  if (anomalies.length === 0) {
    return (
      <section className="mb-6 rounded-2xl border border-[color:#bbf7d0] bg-[color:var(--color-up-bg)] p-5 text-center">
        <Check className="mx-auto mb-2 h-6 w-6 text-[color:var(--color-up)]" />
        <div className="font-semibold text-[color:var(--color-up)]">All caught up.</div>
        <div className="text-sm text-[color:var(--color-text-soft)] mt-1">Nothing suspicious right now.</div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[color:var(--color-warn)]" />
          {visible.length} thing{visible.length === 1 ? "" : "s"} to check
        </h2>
        <span className="text-xs text-[color:var(--color-text-mute)]">tap ✓ once you&apos;ve handled it</span>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {anomalies.map((a, i) => dismissed.has(i) ? null : (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 flex items-start gap-3"
            >
              <div className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-[color:var(--color-warn-bg)]">
                <AlertTriangle className="h-4 w-4 text-[color:var(--color-warn)]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {a.type === "missing_splitwise_entry" ? (
                    <>
                      Sent <span className="font-mono-tab">{fmtUSD(Math.abs(a.amount || 0))}</span> to {(a.recipient || "?").replace(/\b\w/g, (c) => c.toUpperCase())}
                      <span className="font-normal text-[color:var(--color-text-mute)]"> · {shortDate(a.date || "")}</span>
                    </>
                  ) : (
                    <>Untagged recurring charge: {a.merchant} · <span className="font-mono-tab">{fmtUSD(a.amount || 0)}</span></>
                  )}
                </div>
                <div className="text-[13px] text-[color:var(--color-text-soft)] mt-0.5 leading-snug">
                  {a.type === "missing_splitwise_entry"
                    ? "Doesn't look like it's on Splitwise. Is it supposed to be split?"
                    : a.hint}
                </div>
              </div>
              <button
                onClick={() => setDismissed((d) => new Set(d).add(i))}
                className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-mute)] hover:bg-[color:var(--color-up-bg)] hover:border-[color:#bbf7d0] hover:text-[color:var(--color-up)] transition-colors"
                aria-label="Mark as handled"
                title="Mark as handled"
              >
                <Check className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
