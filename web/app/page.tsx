import { loadUnified, loadAnomalies } from "@/lib/data";
import Summary from "@/components/Summary";
import BigInflowTrace from "@/components/BigInflowTrace";
import Anomalies from "@/components/Anomalies";
import Timeline from "@/components/Timeline";
import TopCategories from "@/components/TopCategories";

export default async function Page() {
  const [unified, anomalies] = await Promise.all([loadUnified(), loadAnomalies()]);
  const all = unified.transactions;

  // Current Chase balance = the most recent chase transaction's balance_after
  const chaseSorted = all
    .filter((t) => t.source === "chase_checking" && t.balance_after != null)
    .sort((a, b) => (b.date.localeCompare(a.date)));
  const currentBalance = chaseSorted[0]?.balance_after ?? 0;

  // Last 30 days for the summary
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

  // Last big income (wire >= $500) for the trace card
  const bigInflow = all
    .filter((t) => t.source === "chase_checking" && t.amount !== null && t.amount >= 500 && !t.is_transfer)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const sinceWire = bigInflow
    ? all.filter((t) => t.source === "chase_checking" && t.date > bigInflow.date && t.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  return (
    <div className="fade-in">
      <Summary
        balance={currentBalance}
        windowFrom={thirtyISO}
        windowTo={today}
        windowSpent={spent30}
        windowReceived={recv30}
        windowLabel="last 30 days"
      />

      {bigInflow && (
        <BigInflowTrace
          inflow={bigInflow}
          laterTransactions={sinceWire}
          endingBalance={currentBalance}
        />
      )}

      <Anomalies anomalies={anomalies} />

      <Timeline transactions={all} />

      <TopCategories transactions={last30} label="last 30 days" />

      <footer className="mt-12 pt-6 text-center text-xs text-[color:var(--color-text-mute)] border-t border-[color:var(--color-border-soft)]">
        Updated {unified.generated_at.slice(0, 16).replace("T", " ")} UTC
      </footer>
    </div>
  );
}
