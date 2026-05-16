import type { Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";
import { Repeat } from "lucide-react";

const PRETTY: Record<string, string> = {
  ai: "AI tools (Claude, Perplexity)",
  apple: "Apple subscriptions",
  movies: "Movie passes (Regal)",
  other: "Other subscriptions",
  uber_one: "Uber One",
};

export default function Subscriptions({ transactions, label }: { transactions: Transaction[]; label: string }) {
  const subs = new Map<string, { amount: number; count: number; last: string; charges: { date: string; amount: number; desc: string }[] }>();

  for (const t of transactions) {
    if (!t.category.startsWith("subscription:") || t.amount === null) continue;
    const key = t.category.replace("subscription:", "");
    const cur = subs.get(key) || { amount: 0, count: 0, last: "", charges: [] };
    cur.amount += Math.abs(t.amount);
    cur.count += 1;
    if (t.date > cur.last) cur.last = t.date;
    cur.charges.push({ date: t.date, amount: Math.abs(t.amount), desc: t.description });
    subs.set(key, cur);
  }

  if (subs.size === 0) return null;

  const sorted = Array.from(subs.entries()).sort((a, b) => b[1].amount - a[1].amount);
  const total = sorted.reduce((a, [, v]) => a + v.amount, 0);

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Recurring subscriptions
          </h2>
          <p className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
            What's quietly billing you, {label}.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-[color:var(--color-text-mute)] uppercase tracking-wide">Total</div>
          <div className="font-mono-tab text-base font-semibold">{fmtUSD(total)}</div>
        </div>
      </div>
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] divide-y divide-[color:var(--color-border-soft)]">
        {sorted.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{PRETTY[k] || k}</div>
              <div className="text-xs text-[color:var(--color-text-mute)] mt-0.5">
                {v.count} charge{v.count === 1 ? "" : "s"} &middot; last {v.last}
              </div>
            </div>
            <div className="font-mono-tab text-base font-semibold">{fmtUSD(v.amount)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
