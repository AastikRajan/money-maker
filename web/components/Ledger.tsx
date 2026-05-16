"use client";
import { useMemo, useState } from "react";
import type { Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";
import { Search } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  chase_checking: "Chase",
  boa_credit: "Card",
  splitwise: "Split",
};

export default function Ledger({ transactions }: { transactions: Transaction[] }) {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const [flow, setFlow] = useState<"all" | "out" | "in" | "transfer">("all");
  const [limit, setLimit] = useState(50);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (q && !t.description.toLowerCase().includes(q.toLowerCase())) return false;
        if (src && t.source !== src) return false;
        if (flow === "out" && (t.amount === null || t.amount >= 0)) return false;
        if (flow === "in" && (t.amount === null || t.amount <= 0)) return false;
        if (flow === "transfer" && !t.is_transfer) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, q, src, flow]);

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-bold">Search every transaction</h2>
        <p className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
          Find anything by name, account, or type.
        </p>
      </div>
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[color:var(--color-border-soft)]">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-text-mute)]" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(50); }}
              placeholder="Search 'costco', 'onkar', 'apple'..."
              className="w-full rounded-lg border border-[color:var(--color-border)] bg-white pl-8 pr-3 py-1.5 text-sm placeholder:text-[color:var(--color-text-mute)] focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
          <select
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="rounded-lg border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-sm"
          >
            <option value="">All accounts</option>
            <option value="chase_checking">Chase</option>
            <option value="boa_credit">BoA Card</option>
            <option value="splitwise">Splitwise</option>
          </select>
          {(["all", "out", "in", "transfer"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFlow(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                flow === f
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "border border-[color:var(--color-border)] bg-white text-[color:var(--color-text-soft)] hover:bg-stone-50"
              }`}
            >
              {f === "all" ? "All" : f === "out" ? "Out" : f === "in" ? "In" : "Transfers"}
            </button>
          ))}
          <span className="text-xs text-[color:var(--color-text-mute)] ml-auto">{filtered.length} results</span>
        </div>
        <ul>
          {filtered.slice(0, limit).map((t, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-[color:var(--color-border-soft)] last:border-0">
              <span className="font-mono-tab text-[11px] text-[color:var(--color-text-mute)] w-16 flex-shrink-0">{t.date}</span>
              <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 flex-shrink-0">
                {SOURCE_LABELS[t.source]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{t.description}</span>
              <span className={`font-mono-tab text-[13px] font-semibold flex-shrink-0 ${
                t.amount === null ? "" :
                t.is_transfer ? "text-[color:var(--color-flat)]" :
                t.amount < 0 ? "text-[color:var(--color-down)]" : "text-[color:var(--color-up)]"
              }`}>
                {t.amount === null ? "—" : (t.amount > 0 ? "+" : "") + fmtUSD(t.amount)}
              </span>
            </li>
          ))}
        </ul>
        {filtered.length > limit && (
          <button
            onClick={() => setLimit(limit + 50)}
            className="w-full py-3 text-sm font-medium text-[color:var(--color-text-soft)] hover:bg-stone-50 border-t border-[color:var(--color-border-soft)]"
          >
            Show 50 more ({filtered.length - limit} left)
          </button>
        )}
      </div>
    </section>
  );
}
