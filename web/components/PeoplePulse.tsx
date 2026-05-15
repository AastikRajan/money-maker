"use client";
import { motion } from "motion/react";
import { fmtUSD } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Equal } from "lucide-react";
import type { PersonBalance } from "@/lib/trace";

export default function PeoplePulse({ people }: { people: PersonBalance[] }) {
  if (people.length === 0) {
    return (
      <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] p-8 text-center font-display italic text-[color:var(--color-ink-mute)]">
        No people activity in window.
      </div>
    );
  }

  // Sort: largest absolute net first
  const sorted = [...people].sort((a, b) => Math.abs(b.net) + Math.abs(b.zelleNet) - (Math.abs(a.net) + Math.abs(a.zelleNet)));
  const max = Math.max(...sorted.map((p) => Math.max(Math.abs(p.net), Math.abs(p.zelleNet))));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sorted.slice(0, 8).map((p, i) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] p-5 shadow-[0_4px_20px_-10px_rgba(28,24,20,0.15)]"
        >
          <div className="flex items-center justify-between">
            <div className="font-display text-2xl italic text-[color:var(--color-ink)]">{p.name}</div>
            <PersonBadge net={p.net} />
          </div>

          <div className="mt-4 space-y-2">
            <FlowRow label="Splitwise balance" value={p.net} max={max} positive="They owe you" negative="You owe them" zero="Settled" />
            <FlowRow label="Zelle activity (net)" value={p.zelleNet} max={max} positive="Net received" negative="Net sent" zero="Even" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function PersonBadge({ net }: { net: number }) {
  if (Math.abs(net) < 0.5) {
    return (
      <span className="flex items-center gap-1 rounded-sm border border-[color:color-mix(in_srgb,var(--color-ink-mute)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-gold)_8%,transparent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-ink-mute)]">
        <Equal className="h-3 w-3" /> Settled
      </span>
    );
  }
  if (net > 0) {
    return (
      <span className="flex items-center gap-1 rounded-sm border border-[color:color-mix(in_srgb,var(--color-emerald-royal)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-emerald-royal)_8%,transparent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-emerald-royal)]">
        <ArrowDownRight className="h-3 w-3" /> Owed to you
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-sm border border-[color:color-mix(in_srgb,var(--color-claret)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-claret)_8%,transparent)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-claret)]">
      <ArrowUpRight className="h-3 w-3" /> You owe
    </span>
  );
}

function FlowRow({ label, value, max, positive, negative, zero }: { label: string; value: number; max: number; positive: string; negative: string; zero: string }) {
  const pct = max ? (Math.abs(value) / max) * 100 : 0;
  const color = Math.abs(value) < 0.5 ? "var(--color-ink-mute)" : value > 0 ? "var(--color-emerald-royal)" : "var(--color-claret)";
  const direction = Math.abs(value) < 0.5 ? zero : value > 0 ? positive : negative;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-[color:var(--color-ink-mute)]">{label}</span>
        <span className="font-mono-tab font-medium" style={{ color }}>
          {fmtUSD(value, { sign: true })}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="h-full rounded-sm"
          style={{ background: color }}
        />
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-ink-mute)]">{direction}</div>
    </div>
  );
}
