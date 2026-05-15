import type { Transaction } from "@/lib/types";
import { fmtUSD } from "@/lib/format";

interface SummaryProps {
  balance: number;
  windowFrom: string;
  windowTo: string;
  windowSpent: number;
  windowReceived: number;
  windowLabel: string;
}

export default function Summary({ balance, windowSpent, windowReceived, windowLabel }: SummaryProps) {
  const net = windowReceived - windowSpent;
  return (
    <section className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">Hi, here&apos;s your money.</h1>
      <p className="mt-2 text-[color:var(--color-text-soft)]">
        You have <strong className="font-mono-tab font-semibold text-[color:var(--color-text)]">{fmtUSD(balance)}</strong> in Chase right now.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label={`Spent ${windowLabel}`} value={windowSpent} tone="down" />
        <Stat label="Received" value={windowReceived} tone="up" />
        <Stat label="Net" value={net} tone={net >= 0 ? "up" : "down"} />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "up" | "down" }) {
  const color = tone === "up" ? "text-[color:var(--color-up)]" : "text-[color:var(--color-down)]";
  return (
    <div className="rounded-xl bg-[color:var(--color-card)] border border-[color:var(--color-border)] p-3">
      <div className="text-[11px] text-[color:var(--color-text-mute)] uppercase tracking-wide truncate">{label}</div>
      <div className={`mt-1 font-mono-tab text-lg font-semibold ${color}`}>
        {tone === "up" && value > 0 ? "+" : ""}{fmtUSD(value)}
      </div>
    </div>
  );
}
