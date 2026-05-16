import { loadUnified, loadAnomalies, loadSplitwise } from "@/lib/data";
import { enrichWithSplitwise } from "@/lib/enrich";
import Summary from "@/components/Summary";
import MonthlyChart from "@/components/MonthlyChart";
import BigInflowTrace from "@/components/BigInflowTrace";
import Anomalies from "@/components/Anomalies";
import MoneyFlow from "@/components/MoneyFlow";
import People from "@/components/People";
import Subscriptions from "@/components/Subscriptions";
import Timeline from "@/components/Timeline";
import TopCategories from "@/components/TopCategories";
import Ledger from "@/components/Ledger";

export default async function Page() {
  const [unified, anomalies, splitwise] = await Promise.all([
    loadUnified(),
    loadAnomalies(),
    loadSplitwise(),
  ]);

  // Enrich Chase Zelles with their Splitwise story (server-side join)
  const allEnriched = enrichWithSplitwise(unified.transactions, splitwise);

  // For client components (Timeline, Ledger): only send the most recent 120 days
  // — keeps the page payload small and snappy. Server components can use the full set.
  const todayMs = Date.now();
  const recentCut = new Date(todayMs - 120 * 86_400_000).toISOString().slice(0, 10);
  const all = allEnriched.filter((t) => t.date >= recentCut);

  // Current Chase balance from most recent transaction (use full set — could be older)
  const chaseSorted = allEnriched
    .filter((t) => t.source === "chase_checking" && t.balance_after != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentBalance = chaseSorted[0]?.balance_after ?? 0;

  const today = new Date().toISOString().slice(0, 10);
  const thirty = new Date();
  thirty.setDate(thirty.getDate() - 30);
  const thirtyISO = thirty.toISOString().slice(0, 10);

  const last30 = all.filter((t) => t.date >= thirtyISO && t.date <= today);
  const spent30 = last30
    .filter((t) => t.amount !== null && t.amount < 0 && !t.is_transfer)
    .reduce((a, t) => a + Math.abs(t.amount!), 0);
  const recv30 = last30
    .filter((t) => t.amount !== null && t.amount > 0 && !t.is_transfer)
    .reduce((a, t) => a + t.amount!, 0);

  // Monthly aggregation for the 3D chart (use full set for 6-month chart)
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const t of allEnriched) {
    if (t.amount === null || t.is_transfer) continue;
    const m = t.date.slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, { in: 0, out: 0 });
    const b = byMonth.get(m)!;
    if (t.amount > 0) b.in += t.amount;
    else b.out += Math.abs(t.amount);
  }
  const monthly = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // Last big income (>= $500) for the trace card
  const bigInflow = all
    .filter((t) => t.source === "chase_checking" && t.amount !== null && t.amount >= 500 && !t.is_transfer)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const sinceWire = bigInflow
    ? all.filter((t) => t.source === "chase_checking" && t.date > bigInflow.date && t.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="fade-in space-y-2">
      <Summary
        balance={currentBalance}
        windowFrom={thirtyISO}
        windowTo={today}
        windowSpent={spent30}
        windowReceived={recv30}
        windowLabel="last 30 days"
      />

      <MonthlyChart monthly={monthly} />

      {bigInflow && (
        <BigInflowTrace
          inflow={bigInflow}
          laterTransactions={sinceWire}
          endingBalance={currentBalance}
        />
      )}

      <Anomalies anomalies={anomalies} />

      <MoneyFlow transactions={last30} label="last 30 days" />

      <People splitwise={splitwise} transactions={all} windowFrom={thirtyISO} />

      <Subscriptions transactions={last30} label="last 30 days" />

      <Timeline transactions={all} />

      <TopCategories transactions={last30} label="last 30 days" />

      <Ledger transactions={all} />

      <footer className="mt-12 pt-6 text-center text-xs text-[color:var(--color-text-mute)] border-t border-[color:var(--color-border-soft)]">
        Updated {unified.generated_at.slice(0, 16).replace("T", " ")} UTC &middot;{" "}
        <a href="https://github.com/AastikRajan/money-maker" className="underline hover:text-[color:var(--color-text)]">github.com/AastikRajan/money-maker</a>
      </footer>
    </div>
  );
}
