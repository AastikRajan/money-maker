"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { fmtUSD } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function Ledger({ transactions, defaultFrom }: { transactions: Transaction[]; defaultFrom: string }) {
  const [text, setText] = useState("");
  const [src, setSrc] = useState("");
  const [cat, setCat] = useState("");
  const [flow, setFlow] = useState("real");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<keyof Transaction>("date");
  const [sortDir, setSortDir] = useState<-1 | 1>(-1);

  const cats = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).sort(), [transactions]);

  const filtered = useMemo(() => {
    let f = transactions.filter((t) => {
      if (text && !t.description.toLowerCase().includes(text.toLowerCase())) return false;
      if (src && t.source !== src) return false;
      if (cat && t.category !== cat) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (flow === "out" && (t.amount === null || t.amount >= 0)) return false;
      if (flow === "in" && (t.amount === null || t.amount <= 0)) return false;
      if (flow === "transfer" && !t.is_transfer) return false;
      if (flow === "real" && (t.is_transfer || t.amount === null || t.amount >= 0)) return false;
      return true;
    });
    f.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
    return f;
  }, [transactions, text, src, cat, from, to, flow, sortKey, sortDir]);

  const sum = filtered.reduce((a, t) => a + (t.amount || 0), 0);

  const toggleSort = (k: keyof Transaction) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else { setSortKey(k); setSortDir(-1); }
  };

  return (
    <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] p-5 shadow-[0_4px_20px_-10px_rgba(28,24,20,0.15)]">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_18%,transparent)] bg-[color:var(--color-parch-warm)] p-3">
        <input
          placeholder="Search description..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-[200px] flex-1 rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-3 py-1.5 text-sm placeholder:italic placeholder:text-[color:var(--color-ink-mute)] focus:border-[color:var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)]"
        />
        <select value={src} onChange={(e) => setSrc(e.target.value)} className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-3 py-1.5 text-sm">
          <option value="">All accounts</option>
          <option value="chase_checking">Chase Checking</option>
          <option value="boa_credit">BoA Credit</option>
          <option value="splitwise">Splitwise</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-3 py-1.5 text-sm">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={flow} onChange={(e) => setFlow(e.target.value)} className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-3 py-1.5 text-sm">
          <option value="">All flows</option>
          <option value="out">Expenditures</option>
          <option value="in">Receipts</option>
          <option value="transfer">Transfers</option>
          <option value="real">Real spending</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-2 py-1.5 text-xs font-mono-tab" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] px-2 py-1.5 text-xs font-mono-tab" />
        <span className="ml-auto font-display italic text-[color:var(--color-ink-soft)]">
          <strong className="font-semibold text-[color:var(--color-ink)]">{filtered.length}</strong> entries &middot; sum <strong className="font-semibold text-[color:var(--color-ink)]">{fmtUSD(sum)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              {[
                ["date", "Date"],
                ["source", "Account"],
                ["description", "Description"],
                ["category", "Category"],
                ["amount", "Amount"],
              ].map(([k, l]) => (
                <th
                  key={k}
                  onClick={() => toggleSort(k as keyof Transaction)}
                  className={`cursor-pointer border-b border-[color:var(--color-gold)] py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-gold-deep)] hover:text-[color:var(--color-ink)] ${k === "amount" ? "text-right" : ""}`}
                >
                  {l}{sortKey === k ? (sortDir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((t, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.005, 0.3) }}
                className="border-b border-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--color-gold)_5%,transparent)]"
              >
                <td className="px-3 py-2 font-mono-tab text-xs text-[color:var(--color-ink-mute)]">{t.date}</td>
                <td className="px-3 py-2">
                  <span className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-deep)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-ink-soft)]">
                    {sourceLabel(t.source)}
                  </span>
                </td>
                <td className="px-3 py-2 text-[color:var(--color-ink-soft)]">
                  {t.description.slice(0, 80)}
                  {t.flags?.map((f, fi) => (
                    <span key={fi} className={`ml-2 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] ${
                      f.includes("missing")
                        ? "border-[color:color-mix(in_srgb,var(--color-claret)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-claret)_10%,transparent)] text-[color:var(--color-claret)]"
                        : "border-[color:color-mix(in_srgb,var(--color-emerald-royal)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-emerald-royal)_10%,transparent)] text-[color:var(--color-emerald-royal)]"
                    }`}>{f}</span>
                  ))}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--color-gold)_10%,transparent)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-gold-deep)]">
                    {t.category}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right font-mono-tab font-medium ${
                  t.amount === null ? "" :
                  t.is_transfer ? "text-[color:var(--color-gold-deep)]" :
                  t.amount < 0 ? "text-[color:var(--color-claret)]" : "text-[color:var(--color-emerald-royal)]"
                }`}>{t.amount !== null ? fmtUSD(t.amount) : "—"}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && (
          <div className="py-3 text-center text-xs italic text-[color:var(--color-ink-mute)]">
            First 300 of {filtered.length} shown. Refine filters.
          </div>
        )}
      </div>
    </div>
  );
}

function sourceLabel(s: string) {
  return { chase_checking: "Chase", boa_credit: "BoA", splitwise: "Splitwise" }[s] || s;
}
