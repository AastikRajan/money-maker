import { loadUnified, loadAnomalies, loadSplitwise } from "@/lib/data";
import { computePeopleNetwork } from "@/lib/trace";
import Hero from "@/components/Hero";
import Vault3D from "@/components/Vault3D";
import MoneyTrace from "@/components/MoneyTrace";
import AnomaliesPanel from "@/components/AnomaliesPanel";
import PeoplePulse from "@/components/PeoplePulse";
import Subscriptions from "@/components/Subscriptions";
import Ledger from "@/components/Ledger";
import SectionHead from "@/components/SectionHead";

export default async function Page() {
  const [unified, anomalies, splitwise] = await Promise.all([
    loadUnified(),
    loadAnomalies(),
    loadSplitwise(),
  ]);

  const txns = unified.transactions;

  // Compute monthly flow for hero/vault
  const byMonth = new Map<string, { in: number; out: number; transfer: number }>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, { in: 0, out: 0, transfer: 0 });
    const b = byMonth.get(m)!;
    if (t.amount === null) continue;
    if (t.is_transfer) b.transfer += Math.abs(t.amount);
    else if (t.amount > 0) b.in += t.amount;
    else b.out += Math.abs(t.amount);
  }
  const monthsKeys = Array.from(byMonth.keys()).sort();
  const monthly = monthsKeys.map((m) => ({ month: m, ...byMonth.get(m)! }));
  const currentMonth = monthsKeys[monthsKeys.length - 1] || new Date().toISOString().slice(0, 7);
  const cur = byMonth.get(currentMonth) || { in: 0, out: 0, transfer: 0 };

  // Find most recent large wire/inflow as pivot for "since the wire"
  const wires = txns.filter((t) => t.category === "income:wire" && t.amount && t.amount >= 1000).sort((a, b) => b.date.localeCompare(a.date));
  const pivotWire = wires[0];

  const monthLabel = new Date(currentMonth + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // People network
  const people = computePeopleNetwork(
    txns.filter((t) => t.date >= currentMonth + "-01"),
    splitwise.friends
  );

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = currentMonth + "-01";

  // Subscriptions for current month
  const subTxns = txns.filter((t) => t.date >= monthStart);

  return (
    <div className="space-y-2">
      <Hero
        generatedAt={unified.generated_at}
        totalInflow={cur.in}
        totalOutflow={cur.out}
        net={cur.in - cur.out}
        anomalyCount={anomalies.length}
        monthLabel={monthLabel}
      />

      <Vault3D monthlyFlow={monthly} />

      <SectionHead
        num={1}
        title="Items Requiring Attention"
        subtitle="Suspected omissions on Splitwise &amp; recurring charges that may have escaped your tagging."
      />
      <AnomaliesPanel anomalies={anomalies} />

      {pivotWire && (
        <>
          <SectionHead
            num={2}
            title="Money Trace"
            subtitle={`Where did your funds go? Pick a window and watch the ribbons. Your last large wire of ${formatUSD(pivotWire.amount!)} on ${pivotWire.date} is set as the default pivot — every dollar from then to now is mapped to a destination, with claret ribbons marking flows that may need a Splitwise entry.`}
          />
          <MoneyTrace
            transactions={txns}
            anomalies={anomalies}
            defaultFrom={pivotWire.date}
            defaultTo={today}
            pivotDate={pivotWire.date}
            pivotLabel={`Since the ${formatUSD(pivotWire.amount!, 0)} wire`}
          />
        </>
      )}

      <SectionHead
        num={3}
        title="The People In Your Finances"
        subtitle="Who you owe, who owes you, and the Zelle traffic between &mdash; cross-checked against Splitwise."
      />
      <PeoplePulse people={people} />

      <SectionHead
        num={4}
        title="Standing Orders"
        subtitle="Recurring charges currently active. Cancel ruthlessly."
      />
      <Subscriptions transactions={subTxns} />

      <SectionHead
        num={5}
        title="The Ledger"
        subtitle="Every entry, filterable. Click a column header to sort."
      />
      <Ledger transactions={txns} defaultFrom={monthStart} />

      <footer className="mt-24 text-center">
        <div className="mx-auto h-px w-60 bg-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)]" />
        <p className="mt-5 font-display text-sm italic text-[color:var(--color-ink-mute)]">
          Compiled {unified.generated_at.slice(0, 16).replace("T", " ")} UTC
        </p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-gold-deep)]">
          M &middot; M &nbsp;&middot;&nbsp; Anno Domini MMXXVI
        </p>
      </footer>
    </div>
  );
}

function formatUSD(n: number, decimals = 2) {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
