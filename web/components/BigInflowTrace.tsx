"use client";
import { useMemo } from "react";
import type { Transaction } from "@/lib/types";
import { fmtUSD, shortDate } from "@/lib/format";

interface Props {
  inflow: Transaction;
  laterTransactions: Transaction[]; // chase only, after the inflow date
  endingBalance: number;
}

export default function BigInflowTrace({ inflow, laterTransactions, endingBalance }: Props) {
  const startBalance = (inflow.balance_after ?? 0);
  const series = useMemo(() => buildBalanceSeries(inflow, laterTransactions), [inflow, laterTransactions]);

  const spentSinceWire = laterTransactions
    .filter((t) => t.amount !== null && t.amount < 0 && !t.is_transfer)
    .reduce((a, t) => a + Math.abs(t.amount!), 0);

  const transferredOut = laterTransactions
    .filter((t) => t.amount !== null && t.amount < 0 && t.is_transfer)
    .reduce((a, t) => a + Math.abs(t.amount!), 0);

  const sender = (inflow.description.match(/B\/O:\s*1\/([^/]+?)\s+3\//i)?.[1] || "family").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // SVG dimensions
  const W = 560;
  const H = 110;
  const PAD = 8;
  const max = Math.max(...series.map(s => s.balance), startBalance);
  const min = Math.min(...series.map(s => s.balance), 0);
  const xs = (i: number) => PAD + (i / Math.max(1, series.length - 1)) * (W - 2 * PAD);
  const ys = (v: number) => H - PAD - ((v - min) / Math.max(1, max - min)) * (H - 2 * PAD);
  const path = series.map((s, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(s.balance).toFixed(1)}`).join(" ");
  const fill = `${path} L ${xs(series.length - 1).toFixed(1)} ${(H - PAD).toFixed(1)} L ${PAD} ${(H - PAD).toFixed(1)} Z`;

  return (
    <section className="mb-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[11px] text-[color:var(--color-text-mute)] uppercase tracking-wide">
            Your last big income
          </div>
          <div className="mt-1 text-xl font-bold">
            <span className="font-mono-tab text-[color:var(--color-up)]">+{fmtUSD(inflow.amount || 0)}</span>{" "}
            wire from {sender}
          </div>
          <div className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
            {shortDate(inflow.date)} · {Math.round((Date.now() - new Date(inflow.date).getTime()) / 86400000)} days ago
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto">
        <defs>
          <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#bal-fill)" />
        <path d={path} fill="none" stroke="#15803d" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        {/* Start dot */}
        <circle cx={xs(0)} cy={ys(series[0].balance)} r="3.5" fill="#15803d" />
        {/* End dot */}
        <circle cx={xs(series.length - 1)} cy={ys(series[series.length - 1].balance)} r="3.5" fill="#0c0a09" />
        {/* Start label */}
        <text x={xs(0) + 6} y={ys(series[0].balance) - 6} fontSize="10" fill="#0c0a09" fontFamily="JetBrains Mono">
          {fmtUSD(series[0].balance, { decimals: 0 })}
        </text>
        {/* End label */}
        <text x={xs(series.length - 1) - 6} y={ys(series[series.length - 1].balance) - 6} fontSize="10" fill="#0c0a09" fontFamily="JetBrains Mono" textAnchor="end">
          {fmtUSD(series[series.length - 1].balance, { decimals: 0 })}
        </text>
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-[color:var(--color-down-bg)] border border-[color:#fee2e2] p-3">
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-down)]">spent on stuff</div>
          <div className="mt-1 font-mono-tab font-semibold text-[color:var(--color-down)]">{fmtUSD(spentSinceWire, { decimals: 0 })}</div>
        </div>
        <div className="rounded-lg bg-[color:#fef3c7] border border-[color:#fde68a] p-3">
          <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-warn)]">moved to others</div>
          <div className="mt-1 font-mono-tab font-semibold text-[color:var(--color-warn)]">{fmtUSD(transferredOut, { decimals: 0 })}</div>
        </div>
        <div className="rounded-lg bg-stone-100 border border-stone-200 p-3">
          <div className="text-[10px] uppercase tracking-wide text-stone-600">left right now</div>
          <div className="mt-1 font-mono-tab font-semibold text-stone-900">{fmtUSD(endingBalance, { decimals: 0 })}</div>
        </div>
      </div>
    </section>
  );
}

function buildBalanceSeries(inflow: Transaction, later: Transaction[]) {
  // Use Chase balance_after when available, fall back to running calculation
  const series: { date: string; balance: number }[] = [];
  if (inflow.balance_after != null) {
    series.push({ date: inflow.date, balance: inflow.balance_after });
  } else {
    series.push({ date: inflow.date, balance: inflow.amount || 0 });
  }
  let running = series[0].balance;
  for (const t of later) {
    if (t.balance_after != null) {
      running = t.balance_after;
    } else if (t.amount != null) {
      running += t.amount;
    }
    series.push({ date: t.date, balance: running });
  }
  // dedupe to one point per day (last wins)
  const byDate = new Map<string, number>();
  for (const p of series) byDate.set(p.date, p.balance);
  return Array.from(byDate.entries()).map(([date, balance]) => ({ date, balance }));
}
