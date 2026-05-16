"use client";
import { useMemo, useState } from "react";
import type { Transaction } from "@/lib/types";
import type { EnrichedTransaction } from "@/lib/enrich";
import { fmtUSD } from "@/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  chase_checking: "Chase",
  boa_credit: "Card",
  splitwise: "Split",
};

interface Props { transactions: EnrichedTransaction[]; }

export default function Timeline({ transactions }: Props) {
  const [hideTransfers, setHideTransfers] = useState(true);
  const [minAmount, setMinAmount] = useState(0);
  const [days, setDays] = useState(30);

  const today = new Date().toISOString().slice(0, 10);
  const cutoffISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }, [days]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (t.date < cutoffISO || t.date > today) return false;
      if (t.amount === null) return false;
      if (hideTransfers && t.is_transfer) return false;
      if (Math.abs(t.amount) < minAmount) return false;
      return true;
    });
  }, [transactions, cutoffISO, today, hideTransfers, minAmount]);

  const grouped = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of filtered) {
      if (!m.has(t.date)) m.set(t.date, []);
      m.get(t.date)!.push(t);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, txns]) => {
        const inAmt = txns.filter((t) => t.amount! > 0).reduce((a, t) => a + t.amount!, 0);
        const outAmt = txns.filter((t) => t.amount! < 0).reduce((a, t) => a + Math.abs(t.amount!), 0);
        return { date, txns, inAmt, outAmt };
      });
  }, [filtered]);

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-bold">Day by day</h2>
        <div className="text-xs text-[color:var(--color-text-mute)]">{filtered.length} entries</div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[7, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              days === d
                ? "bg-[color:var(--color-accent)] text-white"
                : "bg-[color:var(--color-card)] border border-[color:var(--color-border)] text-[color:var(--color-text-soft)] hover:bg-stone-100"
            }`}
          >
            {d === 7 ? "Last week" : d === 30 ? "Last 30 days" : d === 60 ? "60 days" : "90 days"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-[color:var(--color-text-soft)]">
          <input
            type="checkbox"
            checked={hideTransfers}
            onChange={(e) => setHideTransfers(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--color-accent)]"
          />
          Hide transfers
        </label>
        <label className="flex items-center gap-2 text-xs text-[color:var(--color-text-soft)]">
          Min $
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(parseFloat(e.target.value) || 0)}
            className="w-14 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-1 text-xs font-mono-tab"
          />
        </label>
      </div>

      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center text-sm text-[color:var(--color-text-mute)]">
            Nothing here in this window. Try a wider one.
          </div>
        )}
        {grouped.map(({ date, txns, inAmt, outAmt }) => (
          <DayCard key={date} date={date} txns={txns} inAmt={inAmt} outAmt={outAmt} />
        ))}
      </div>
    </section>
  );
}

function DayCard({ date, txns, inAmt, outAmt }: { date: string; txns: EnrichedTransaction[]; inAmt: number; outAmt: number }) {
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dayLabel =
    d.toDateString() === today.toDateString()
      ? "Today"
      : d.toDateString() === yesterday.toDateString()
      ? "Yesterday"
      : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border-soft)] bg-stone-50">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{dayLabel}</span>
          <span className="text-xs text-[color:var(--color-text-mute)]">{date}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono-tab">
          {inAmt > 0 && <span className="text-[color:var(--color-up)]">+{fmtUSD(inAmt, { decimals: 0 })}</span>}
          {outAmt > 0 && <span className="text-[color:var(--color-down)]">−{fmtUSD(outAmt, { decimals: 0 })}</span>}
        </div>
      </div>
      <ul>
        {txns.map((t, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-border-soft)] last:border-0"
          >
            <SourceDot source={t.source} amount={t.amount!} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{cleanDescription(t.description)}</div>
              <div className="text-[11px] text-[color:var(--color-text-mute)] uppercase tracking-wide mt-0.5">
                {SOURCE_LABELS[t.source]} · {prettyCategory(t.category)}
                {t.flags?.includes("possibly_missing_splitwise") && (
                  <span className="ml-2 rounded-sm bg-[color:var(--color-warn-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-warn)] normal-case tracking-normal">
                    check splitwise
                  </span>
                )}
              </div>
              {t.story && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[color:var(--color-text-soft)] leading-snug">
                  <span className="text-[color:var(--color-text-mute)] flex-shrink-0">↳</span>
                  <span className="italic">{t.story}</span>
                </div>
              )}
            </div>
            <div
              className={`flex-shrink-0 font-mono-tab text-[15px] font-semibold tabular-nums ${
                t.is_transfer
                  ? "text-[color:var(--color-flat)]"
                  : t.amount! > 0
                  ? "text-[color:var(--color-up)]"
                  : "text-[color:var(--color-down)]"
              }`}
            >
              {t.amount! > 0 ? "+" : ""}{fmtUSD(t.amount!)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceDot({ source, amount }: { source: string; amount: number }) {
  const color = amount > 0 ? "bg-[color:var(--color-up)]" : "bg-[color:var(--color-down)]";
  const letter = SOURCE_LABELS[source]?.[0] || "?";
  return (
    <div className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ${color} text-[11px] font-bold text-white`}>
      {letter}
    </div>
  );
}

function cleanDescription(d: string): string {
  return d
    .replace(/Card \d{4}/gi, "")
    .replace(/Recurring Card Purchase \d{2}\/\d{2}/i, "")
    .replace(/Card Purchase(?: With Pin)? \d{2}\/\d{2}/i, "")
    .replace(/Web ID:.*$/i, "")
    .replace(/CONF#\w+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function prettyCategory(c: string): string {
  if (c.startsWith("transfer:")) return "transfer";
  if (c.startsWith("subscription:")) return "subscription";
  if (c.startsWith("income:")) return "income";
  if (c.startsWith("food:")) return "food";
  if (c.startsWith("transport:")) return "transport";
  if (c.startsWith("shopping:")) return "shopping";
  if (c.startsWith("splitwise:")) return c.replace("splitwise:", "");
  return c.replace(/[:_]/g, " ");
}
