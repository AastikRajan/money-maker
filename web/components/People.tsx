import type { SplitwiseData, Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Equal } from "lucide-react";

interface Person {
  id: number;
  name: string;
  splitwiseBalance: number;   // + they owe you / - you owe them (USD aggregated)
  zelleNet: number;           // + you received from them / - you sent to them (in window)
  recentExpense?: { description: string; date: string; cost: number };
}

export default function People({
  splitwise,
  transactions,
  windowFrom,
}: {
  splitwise: SplitwiseData;
  transactions: Transaction[];
  windowFrom: string;
}) {
  const myId = splitwise.current_user.id;
  const people: Person[] = [];

  for (const f of splitwise.friends) {
    const name = `${f.first_name} ${f.last_name || ""}`.trim();
    const balUSD = (f.balance || []).reduce((a, b) => a + parseFloat(b.amount || "0"), 0);

    // Zelle net in window
    let zelleNet = 0;
    const lcFirst = (f.first_name || "").toLowerCase();
    for (const t of transactions) {
      if (t.source !== "chase_checking" || !lcFirst) continue;
      if (t.date < windowFrom) continue;
      if (t.category !== "transfer:zelle_out" && t.category !== "income:zelle_in") continue;
      if (!t.description.toLowerCase().includes(lcFirst)) continue;
      if (t.amount) zelleNet += t.amount; // amount sign already correct: + in, - out
    }

    // Skip if no activity at all
    if (Math.abs(balUSD) < 0.01 && Math.abs(zelleNet) < 0.01) continue;

    // Most recent splitwise expense involving them
    const recent = (splitwise.expenses || [])
      .filter((e) => !e.deleted_at && !e.payment && e.users.some((u) => u.user_id === f.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    people.push({
      id: f.id,
      name,
      splitwiseBalance: balUSD,
      zelleNet,
      recentExpense: recent ? { description: recent.description, date: recent.date.slice(0, 10), cost: parseFloat(recent.cost) } : undefined,
    });
  }

  if (people.length === 0) return null;

  // Sort: settled (=0) last, then by absolute total interaction
  const sorted = people.sort((a, b) => {
    const aSettled = Math.abs(a.splitwiseBalance) < 0.01 ? 1 : 0;
    const bSettled = Math.abs(b.splitwiseBalance) < 0.01 ? 1 : 0;
    if (aSettled !== bSettled) return aSettled - bSettled;
    return Math.abs(b.splitwiseBalance) - Math.abs(a.splitwiseBalance);
  });

  // Suppress users who marked themselves with zero everything
  const top = sorted.slice(0, 8);

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-bold">People in your money</h2>
        <p className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
          Splitwise balance and Zelle activity, side by side.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {top.map((p) => (
          <PersonCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}

function PersonCard({ p }: { p: Person }) {
  const settled = Math.abs(p.splitwiseBalance) < 0.5;
  let badge;
  if (settled) {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
        <Equal className="h-3 w-3" /> Settled
      </span>
    );
  } else if (p.splitwiseBalance > 0) {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-up-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-up)]">
        <ArrowDownLeft className="h-3 w-3" /> Owes you
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-down-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-down)]">
        <ArrowUpRight className="h-3 w-3" /> You owe
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="font-semibold text-base">{p.name}</div>
        {badge}
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Splitwise balance" value={p.splitwiseBalance} />
        <Row label="Zelle (recent)" value={p.zelleNet} />
      </div>
      {p.recentExpense && (
        <div className="mt-3 pt-3 border-t border-[color:var(--color-border-soft)] text-xs text-[color:var(--color-text-mute)]">
          Last shared: <span className="text-[color:var(--color-text-soft)]">{p.recentExpense.description}</span>
          <span className="font-mono-tab"> · {p.recentExpense.date}</span>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  const settled = Math.abs(value) < 0.5;
  const color = settled ? "text-[color:var(--color-text-mute)]" : value > 0 ? "text-[color:var(--color-up)]" : "text-[color:var(--color-down)]";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[color:var(--color-text-soft)]">{label}</span>
      <span className={`font-mono-tab font-semibold ${color}`}>
        {settled ? "$0" : (value > 0 ? "+" : "") + fmtUSD(value)}
      </span>
    </div>
  );
}
