import type { Transaction, SplitwiseData, SplitwiseExpense } from "./types";

export interface EnrichedTransaction extends Transaction {
  story?: string;
  storyMeta?: {
    splitwiseId: number;
    splitwiseDate: string;
    splitwiseDesc: string;
    isPayment: boolean;
    sharedWith?: string;
    yourShare?: number;
    paidBy?: string;
  };
}

const ZELLE_TO_RE = /zelle payment to\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+[A-Z0-9]{8,}|$)/i;
const ZELLE_FROM_RE = /zelle payment from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+\d|$)/i;

function extractZelleName(description: string, direction: "to" | "from"): string | null {
  const m = (direction === "to" ? ZELLE_TO_RE : ZELLE_FROM_RE).exec(description);
  if (!m) return null;
  return m[1].trim();
}

function dayDiff(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

export function enrichWithSplitwise(
  transactions: Transaction[],
  splitwise: SplitwiseData
): EnrichedTransaction[] {
  const myId = splitwise.current_user.id;
  const exps = (splitwise.expenses || []).filter((e) => !e.deleted_at);

  // Index Splitwise expenses by participant first-name (lowercased)
  const byPerson = new Map<string, SplitwiseExpense[]>();
  for (const e of exps) {
    for (const u of e.users) {
      const name = (u.user?.first_name || "").toLowerCase();
      if (!name) continue;
      if (!byPerson.has(name)) byPerson.set(name, []);
      byPerson.get(name)!.push(e);
    }
  }

  return transactions.map((t) => {
    if (t.source !== "chase_checking") return t;
    const isOut = t.category === "transfer:zelle_out";
    const isIn = t.category === "income:zelle_in";
    if (!isOut && !isIn) return t;

    const name = extractZelleName(t.description, isOut ? "to" : "from");
    if (!name) return t;
    const first = name.split(/\s+/)[0].toLowerCase();
    const candidates = byPerson.get(first) || [];
    if (candidates.length === 0) return t;

    const amount = Math.abs(t.amount || 0);

    // Score candidates: prefer payment-type + close amount + close date
    const scored = candidates
      .map((e) => {
        const cost = parseFloat(e.cost);
        const diff = dayDiff(e.date, t.date);
        const amtDiff = Math.abs(cost - amount);
        // weight: payment matches first, then close amount, then close date
        const score =
          (e.payment ? 0 : 1000) + amtDiff * 5 + diff * 10;
        return { e, score, diff };
      })
      .filter((s) => s.diff <= 7)
      .sort((a, b) => a.score - b.score);

    if (scored.length === 0) return t;
    const best = scored[0].e;

    const payer = best.users.find((u) => parseFloat(u.paid_share) > 0);
    const payerName =
      payer?.user_id === myId
        ? "you"
        : payer?.user?.first_name || "someone";

    const yourLine = best.users.find((u) => u.user_id === myId);
    const yourShare = yourLine ? parseFloat(yourLine.owed_share) : undefined;

    let story: string;
    if (best.payment) {
      story = `Splitwise settle-up · ${best.description || "balance payment"}`;
    } else {
      const cost = parseFloat(best.cost);
      story = `For "${best.description}" · ${payerName === "you" ? "you" : payerName} paid $${cost.toFixed(2)}${
        yourShare ? `, your share $${yourShare.toFixed(2)}` : ""
      }`;
    }

    return {
      ...t,
      story,
      storyMeta: {
        splitwiseId: best.id,
        splitwiseDate: best.date.slice(0, 10),
        splitwiseDesc: best.description || "",
        isPayment: best.payment,
        sharedWith: best.users.map((u) => u.user?.first_name).filter(Boolean).join(", "),
        yourShare,
        paidBy: payerName,
      },
    };
  });
}
