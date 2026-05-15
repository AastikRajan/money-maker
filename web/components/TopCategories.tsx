import type { Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";

const PRETTY: Record<string, string> = {
  groceries: "Groceries",
  "food:dining": "Restaurants",
  "food:delivery": "Food delivery",
  "shopping:amazon": "Amazon",
  "transport:rideshare": "Uber & Lyft",
  "transport:other": "Transport",
  "subscription:ai": "AI tools",
  "subscription:apple": "Apple",
  "subscription:movies": "Movies",
  "subscription:other": "Subscriptions",
  "subscription:uber_one": "Uber One",
  "personal:vape": "Vape",
  "entertainment:movies": "Movie tickets",
  "fee:bank": "Bank fees",
  "business:office": "Office",
};

function pretty(c: string): string {
  if (PRETTY[c]) return PRETTY[c];
  if (c.startsWith("splitwise:")) return c.replace("splitwise:", "").replace(/_/g, " ");
  return c.replace(/[:_]/g, " ");
}

export default function TopCategories({ transactions, label }: { transactions: Transaction[]; label: string }) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount === null || t.amount >= 0 || t.is_transfer) continue;
    totals.set(t.category, (totals.get(t.category) || 0) + Math.abs(t.amount));
  }
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (sorted.length === 0) return null;
  const max = sorted[0][1];

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold">Where it goes</h2>
        <span className="text-xs text-[color:var(--color-text-mute)]">{label}</span>
      </div>
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 space-y-3">
        {sorted.map(([cat, total]) => (
          <div key={cat}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium">{pretty(cat)}</span>
              <span className="font-mono-tab text-sm font-semibold">{fmtUSD(total)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-[color:var(--color-accent)]"
                style={{ width: `${(total / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
