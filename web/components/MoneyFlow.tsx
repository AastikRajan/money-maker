import type { Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";
import { ArrowRight } from "lucide-react";

const LABELS: Record<string, string> = {
  "income:wire": "Wires from family",
  "income:zelle_in": "Zelle from people",
  "income:refund": "Refunds",
  "income:rewards": "Cashback rewards",
  "groceries": "Groceries",
  "food:dining": "Restaurants",
  "food:delivery": "Food delivery",
  "shopping:amazon": "Amazon",
  "transport:rideshare": "Uber & Lyft",
  "transport:other": "Other transport",
  "subscription:ai": "AI tools",
  "subscription:apple": "Apple",
  "subscription:movies": "Movie passes",
  "subscription:other": "Other subscriptions",
  "subscription:uber_one": "Uber One",
  "personal:vape": "Vape",
  "entertainment:movies": "Movie tickets",
  "fee:bank": "Bank fees",
  "business:office": "Office",
  "transfer:zelle_out": "Sent to people",
  "transfer:cc_payment": "Paid the credit card",
  "transfer:splitwise_settle": "Settled on Splitwise",
};

function pretty(c: string): string {
  if (LABELS[c]) return LABELS[c];
  if (c.startsWith("splitwise:")) return c.replace("splitwise:", "").replace(/_/g, " ");
  return c.replace(/[:_]/g, " ");
}

export default function MoneyFlow({ transactions, label }: { transactions: Transaction[]; label: string }) {
  const inflows = new Map<string, number>();
  const outflows = new Map<string, number>();
  let totalIn = 0, totalOut = 0;

  for (const t of transactions) {
    if (t.amount === null) continue;
    if (t.is_transfer) {
      if (t.amount < 0) {
        outflows.set(t.category, (outflows.get(t.category) || 0) + Math.abs(t.amount));
        totalOut += Math.abs(t.amount);
      }
      continue;
    }
    if (t.amount > 0) {
      inflows.set(t.category, (inflows.get(t.category) || 0) + t.amount);
      totalIn += t.amount;
    } else {
      outflows.set(t.category, (outflows.get(t.category) || 0) + Math.abs(t.amount));
      totalOut += Math.abs(t.amount);
    }
  }

  const inSorted = Array.from(inflows.entries()).sort((a, b) => b[1] - a[1]);
  const outSorted = Array.from(outflows.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxIn = inSorted[0]?.[1] || 1;
  const maxOut = outSorted[0]?.[1] || 1;

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-bold">Where your money flowed</h2>
        <p className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
          What came in &middot; What it became &middot; {label}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        {/* IN */}
        <div className="rounded-2xl border border-[color:#bbf7d0] bg-[color:var(--color-up-bg)] p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-up)]">Money in</span>
            <span className="font-mono-tab text-base font-semibold text-[color:var(--color-up)]">+{fmtUSD(totalIn)}</span>
          </div>
          <div className="space-y-2">
            {inSorted.length === 0 && <div className="text-sm italic text-[color:var(--color-text-mute)]">No income in window.</div>}
            {inSorted.map(([cat, v]) => (
              <FlowRow key={cat} label={pretty(cat)} value={v} max={maxIn} tone="up" />
            ))}
          </div>
        </div>

        {/* arrow */}
        <div className="hidden md:flex items-center justify-center">
          <ArrowRight className="h-6 w-6 text-[color:var(--color-text-mute)]" />
        </div>

        {/* OUT */}
        <div className="rounded-2xl border border-[color:#fecaca] bg-[color:var(--color-down-bg)] p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-down)]">Money out</span>
            <span className="font-mono-tab text-base font-semibold text-[color:var(--color-down)]">−{fmtUSD(totalOut)}</span>
          </div>
          <div className="space-y-2">
            {outSorted.length === 0 && <div className="text-sm italic text-[color:var(--color-text-mute)]">Nothing went out.</div>}
            {outSorted.map(([cat, v]) => (
              <FlowRow key={cat} label={pretty(cat)} value={v} max={maxOut} tone="down" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: "up" | "down" }) {
  const pct = (value / max) * 100;
  const fill = tone === "up" ? "bg-[color:var(--color-up)]" : "bg-[color:var(--color-down)]";
  const text = tone === "up" ? "text-[color:var(--color-up)]" : "text-[color:var(--color-down)]";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-[color:var(--color-text)] font-medium">{label}</span>
        <span className={`font-mono-tab font-semibold ${text}`}>{fmtUSD(value, { decimals: 0 })}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
