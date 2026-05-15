import type { Transaction, Anomaly } from "./types";

export interface SankeyNode {
  id: string;
  label: string;
  kind: "inflow" | "channel" | "category" | "merchant" | "person" | "subscription";
  value: number;
  meta?: Record<string, unknown>;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  meta?: { date?: string; description?: string; flagged?: boolean };
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

const merchantKey = (desc: string) =>
  desc
    .toLowerCase()
    .replace(/\d{6,}/g, "")
    .replace(/card \d{4}/gi, "")
    .replace(/web id:.*$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");

export function buildMoneyTrace(
  txns: Transaction[],
  opts: { from: string; to: string; anomalies: Anomaly[] }
): SankeyData {
  const inRange = txns.filter((t) => t.date >= opts.from && t.date <= opts.to);
  const flaggedDates = new Set(
    opts.anomalies
      .filter((a) => a.type === "missing_splitwise_entry" && a.date)
      .map((a) => `${a.date}|${Math.abs(a.amount || 0).toFixed(2)}`)
  );

  // Source nodes (inflows): grouped by type
  const inflowGroups = new Map<string, { value: number; events: Transaction[] }>();
  for (const t of inRange) {
    if (t.amount && t.amount > 0 && !t.is_transfer) {
      let key = "Other receipts";
      if (t.category === "income:wire") key = "Wires from family";
      else if (t.category === "income:zelle_in") key = "Zelle received";
      else if (t.category === "income:refund") key = "Refunds";
      else if (t.category === "income:rewards") key = "Rewards & cashback";
      const g = inflowGroups.get(key) || { value: 0, events: [] };
      g.value += t.amount;
      g.events.push(t);
      inflowGroups.set(key, g);
    }
  }

  // Outflow buckets: by category, with flagged subset
  const outflowGroups = new Map<string, { value: number; events: Transaction[]; flagged: number }>();
  for (const t of inRange) {
    if (t.amount === null || t.amount >= 0) continue;
    if (t.category.startsWith("transfer:cc_payment")) continue; // handled as a channel
    const key = humanizeCategory(t.category);
    const g = outflowGroups.get(key) || { value: 0, events: [], flagged: 0 };
    g.value += Math.abs(t.amount);
    g.events.push(t);
    const flagKey = `${t.date}|${Math.abs(t.amount).toFixed(2)}`;
    if (flaggedDates.has(flagKey)) g.flagged += Math.abs(t.amount);
    outflowGroups.set(key, g);
  }

  // Channel nodes: "Chase debit", "BoA credit", "Splitwise settle", "Zelle out"
  const totalIn = Array.from(inflowGroups.values()).reduce((a, g) => a + g.value, 0);
  const totalOut = Array.from(outflowGroups.values()).reduce((a, g) => a + g.value, 0);
  const totalKept = Math.max(0, totalIn - totalOut);

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const pushNode = (n: SankeyNode) => {
    if (!nodes.find((x) => x.id === n.id)) nodes.push(n);
  };

  // Inflows -> "Available funds"
  pushNode({ id: "pool", label: "Available funds", kind: "channel", value: totalIn });
  for (const [name, g] of inflowGroups) {
    const id = `in:${name}`;
    pushNode({ id, label: name, kind: "inflow", value: g.value, meta: { count: g.events.length } });
    links.push({ source: id, target: "pool", value: g.value });
  }

  // Available funds -> categories
  for (const [name, g] of outflowGroups) {
    const id = `cat:${name}`;
    pushNode({ id, label: name, kind: "category", value: g.value, meta: { count: g.events.length, flagged: g.flagged } });
    links.push({
      source: "pool",
      target: id,
      value: g.value,
      meta: { flagged: g.flagged > 0 },
    });

    // Each category -> top 3 merchants/recipients
    const byMerchant = new Map<string, { value: number; events: Transaction[]; flagged: boolean }>();
    for (const t of g.events) {
      const m = merchantKey(t.description) || "Other";
      const cur = byMerchant.get(m) || { value: 0, events: [], flagged: false };
      cur.value += Math.abs(t.amount || 0);
      cur.events.push(t);
      const flagKey = `${t.date}|${Math.abs(t.amount || 0).toFixed(2)}`;
      if (flaggedDates.has(flagKey)) cur.flagged = true;
      byMerchant.set(m, cur);
    }
    const top = Array.from(byMerchant.entries()).sort((a, b) => b[1].value - a[1].value).slice(0, 3);
    const topSum = top.reduce((a, [, v]) => a + v.value, 0);
    for (const [name2, v] of top) {
      const mid = `m:${name}:${name2}`;
      const isPerson = /^to [a-z]/.test(name2) || name.toLowerCase().includes("settle") || /zelle/.test(name2);
      pushNode({
        id: mid,
        label: titleCase(name2),
        kind: isPerson ? "person" : "merchant",
        value: v.value,
        meta: { count: v.events.length, flagged: v.flagged },
      });
      links.push({ source: id, target: mid, value: v.value, meta: { flagged: v.flagged } });
    }
    if (g.value - topSum > 1) {
      const restId = `m:${name}:rest`;
      pushNode({ id: restId, label: "Other", kind: "merchant", value: g.value - topSum });
      links.push({ source: id, target: restId, value: g.value - topSum });
    }
  }

  if (totalKept > 0) {
    pushNode({ id: "kept", label: "Net retained", kind: "category", value: totalKept });
    links.push({ source: "pool", target: "kept", value: totalKept });
  }

  return { nodes, links };
}

export function humanizeCategory(cat: string): string {
  const map: Record<string, string> = {
    "transfer:zelle_out": "Zelle to people",
    "transfer:cc_payment": "Credit card payment",
    "transfer:splitwise_settle": "Splitwise settle-up",
    "groceries": "Groceries",
    "food:dining": "Restaurants & dining",
    "food:delivery": "Food delivery",
    "subscription:ai": "AI subscriptions",
    "subscription:apple": "Apple subscriptions",
    "subscription:movies": "Movie subscriptions",
    "subscription:uber_one": "Uber One",
    "subscription:other": "Other subscriptions",
    "transport:rideshare": "Rideshare",
    "transport:other": "Other transport",
    "shopping:amazon": "Amazon",
    "personal:vape": "Vape & tobacco",
    "entertainment:movies": "Movie tickets",
    "business:office": "Office supplies",
    "fee:bank": "Bank fees",
  };
  if (map[cat]) return map[cat];
  if (cat.startsWith("splitwise:")) return titleCase(cat.replace("splitwise:", "").replace(/_/g, " "));
  return titleCase(cat.replace(/[:_]/g, " "));
}

export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface PersonBalance {
  name: string;
  id: number;
  net: number; // positive = they owe you, negative = you owe them
  zelleNet: number; // net Zelle activity in window
  splitwiseLogged: number; // sum of Splitwise expenses involving them
  flagged: boolean;
}

export function computePeopleNetwork(
  txns: Transaction[],
  splitwiseFriends: { id: number; first_name: string; last_name?: string; balance?: { amount: string }[] }[]
): PersonBalance[] {
  const byName = new Map<string, PersonBalance>();
  for (const f of splitwiseFriends) {
    const name = `${f.first_name} ${f.last_name || ""}`.trim();
    const balUSD = (f.balance || []).reduce((a, b) => a + parseFloat(b.amount || "0"), 0);
    byName.set(name.toLowerCase(), {
      name,
      id: f.id,
      net: balUSD,
      zelleNet: 0,
      splitwiseLogged: 0,
      flagged: false,
    });
  }
  for (const t of txns) {
    if (t.source !== "chase_checking") continue;
    const isOut = t.category === "transfer:zelle_out";
    const isIn = t.category === "income:zelle_in";
    if (!isOut && !isIn) continue;
    const m = t.description.match(/zelle payment (?:to|from)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
    if (!m) continue;
    const first = m[1].split(/\s+/)[0].toLowerCase();
    for (const [k, p] of byName) {
      if (k.startsWith(first)) {
        p.zelleNet += isOut ? -(t.amount || 0) : (t.amount || 0);
      }
    }
  }
  return Array.from(byName.values()).filter((p) => p.zelleNet !== 0 || Math.abs(p.net) > 0.01);
}
