"use client";
import { motion } from "motion/react";
import { fmtUSD, toRoman } from "@/lib/format";
import type { Anomaly } from "@/lib/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function AnomaliesPanel({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-emerald-royal)_30%,transparent)] bg-gradient-to-br from-[color:color-mix(in_srgb,var(--color-emerald-royal)_5%,var(--color-parch-light))] to-[color:var(--color-parch-light)] p-10 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[color:var(--color-emerald-royal)]" />
        <div className="font-display text-2xl italic text-[color:var(--color-emerald-royal)]">
          All accounts in good order
        </div>
        <div className="mt-2 text-sm text-[color:var(--color-ink-mute)]">
          No suspected omissions or untagged charges to review.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-claret)_30%,transparent)] bg-[color:var(--color-parch-light)] shadow-[0_8px_30px_-15px_rgba(110,31,42,0.25)]">
      <div className="flex items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--color-claret)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--color-claret)_5%,var(--color-parch-light))] px-5 py-3">
        <AlertCircle className="h-5 w-5 text-[color:var(--color-claret)]" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-claret)]">
          {toRoman(anomalies.length)} items requiring attention
        </div>
        <div className="ml-auto font-display text-sm italic text-[color:var(--color-ink-mute)]">
          Likely Splitwise omissions &middot; review and reconcile
        </div>
      </div>
      <div>
        {anomalies.map((a, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.4 }}
            className="relative border-t border-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)] bg-gradient-to-r from-[color:color-mix(in_srgb,var(--color-claret)_5%,var(--color-parch-light))] to-transparent px-7 py-4 first:border-t-0"
          >
            <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[color:var(--color-claret)]" />
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 font-display text-lg italic font-semibold text-[color:var(--color-claret)]">
                {toRoman(i + 1)}.
              </span>
              <div className="flex-1">
                <div className="font-display text-[17px] italic font-semibold text-[color:var(--color-claret)]">
                  {a.type === "missing_splitwise_entry" ? (
                    <>
                      <span className="font-mono-tab not-italic text-sm">{a.date}</span>
                      <span className="mx-2 text-[color:var(--color-gold)]">&mdash;</span>
                      <span className="font-mono-tab not-italic">{fmtUSD(Math.abs(a.amount || 0))}</span>
                      <span className="mx-2">to</span>
                      {(a.recipient || "?").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </>
                  ) : (
                    <>Untagged recurring charge: {a.merchant} ({fmtUSD(a.amount || 0)})</>
                  )}
                </div>
                <div className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-ink-soft)]">
                  {a.hint}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
