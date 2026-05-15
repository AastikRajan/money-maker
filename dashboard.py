"""Generate a self-contained HTML dashboard from data/unified.json.

The output (dashboard.html) is a single file you double-click to open. No server,
no build step. Uses Chart.js from CDN for charts. Embeds the dataset as JSON
inside a <script> tag so all filtering/sorting happens client-side.
"""
from __future__ import annotations
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).parent / "data"
OUT = Path(__file__).parent / "dashboard.html"


def month_key(d: str) -> str:
    return d[:7] if d else "unknown"


def compute_summary(txns: list[dict]) -> dict:
    """Aggregations used by the dashboard."""
    by_month_cat: dict = defaultdict(lambda: defaultdict(float))
    by_month_flow: dict = defaultdict(lambda: {"in": 0.0, "out": 0.0, "transfer": 0.0})
    by_merchant: dict[str, dict] = defaultdict(lambda: {"total": 0.0, "count": 0, "category": ""})
    by_source: dict = defaultdict(int)
    subscriptions: dict = defaultdict(lambda: {"amount": 0.0, "count": 0, "last_seen": ""})

    for t in txns:
        amt = t.get("amount")
        if amt is None:
            continue
        m = month_key(t["date"])
        cat = t["category"]
        by_source[t["source"]] += 1

        if t.get("is_transfer"):
            by_month_flow[m]["transfer"] += abs(amt)
        elif amt > 0:
            by_month_flow[m]["in"] += amt
        else:
            by_month_flow[m]["out"] += abs(amt)
            by_month_cat[m][cat] += abs(amt)
            # merchant from first 3 desc words
            merchant = " ".join(t["description"].split()[:3])
            by_merchant[merchant]["total"] += abs(amt)
            by_merchant[merchant]["count"] += 1
            by_merchant[merchant]["category"] = cat

        if cat.startswith("subscription:"):
            subscriptions[cat]["amount"] += abs(amt)
            subscriptions[cat]["count"] += 1
            if t["date"] > subscriptions[cat]["last_seen"]:
                subscriptions[cat]["last_seen"] = t["date"]

    # Top merchants
    top_merchants = sorted(
        [{"name": k, **v} for k, v in by_merchant.items()],
        key=lambda x: -float(x["total"]),
    )[:25]

    return {
        "by_month_cat": {m: dict(v) for m, v in by_month_cat.items()},
        "by_month_flow": dict(by_month_flow),
        "top_merchants": top_merchants,
        "by_source": dict(by_source),
        "subscriptions": {k: dict(v) for k, v in subscriptions.items()},
    }


HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Money Maker — Personal Finance Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root {
  --bg: #0f1419;
  --panel: #1a1f2e;
  --panel-2: #232938;
  --border: #2d3548;
  --text: #e6e8eb;
  --text-dim: #8b95a7;
  --accent: #6ba6ff;
  --good: #4ade80;
  --bad: #f87171;
  --warn: #fbbf24;
  --transfer: #a78bfa;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  font-size: 14px; line-height: 1.5;
}
h1 { margin: 0 0 4px; font-size: 24px; }
h2 { margin: 32px 0 12px; font-size: 16px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
.sub { color: var(--text-dim); margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px;
}
.card .label { color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
.card .value { font-size: 22px; font-weight: 600; margin-top: 6px; }
.card .delta { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
.good { color: var(--good); }
.bad { color: var(--bad); }
.warn { color: var(--warn); }
.transfer { color: var(--transfer); }
.panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-top: 12px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
th { color: var(--text-dim); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; user-select: none; }
th:hover { color: var(--text); }
tbody tr:hover { background: var(--panel-2); }
.amount { text-align: right; font-variant-numeric: tabular-nums; }
.tag {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; background: var(--panel-2); color: var(--text-dim);
  margin-right: 4px;
}
.tag.flag-warn { background: #422; color: var(--warn); }
.tag.flag-good { background: #142; color: var(--good); }
canvas { max-width: 100%; }
.controls { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
.controls input, .controls select {
  background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 6px; padding: 6px 10px; font-size: 13px; font-family: inherit;
}
.controls input:focus, .controls select:focus { outline: none; border-color: var(--accent); }
.anomaly { background: #2a1a0a; border-left: 3px solid var(--warn); padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 8px; }
.anomaly .hdr { font-weight: 600; color: var(--warn); margin-bottom: 4px; }
.anomaly .hint { color: var(--text-dim); font-size: 13px; }
.empty { padding: 16px; color: var(--text-dim); text-align: center; }
</style>
</head>
<body>

<h1>Money Maker</h1>
<div class="sub">Personal finance dashboard · generated <span id="gen-time"></span></div>

<div class="cards" id="metric-cards"></div>

<h2>Needs your attention</h2>
<div class="panel" id="anomalies"></div>

<h2>Monthly cash flow</h2>
<div class="panel"><canvas id="flow-chart" height="100"></canvas></div>

<div class="grid-2">
  <div>
    <h2>Spending by category (current month)</h2>
    <div class="panel"><canvas id="cat-chart" height="200"></canvas></div>
  </div>
  <div>
    <h2>Subscriptions</h2>
    <div class="panel">
      <table id="subs-table">
        <thead><tr><th>Subscription</th><th>Charges</th><th class="amount">Total</th><th>Last seen</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>
</div>

<h2>Top merchants (by spend)</h2>
<div class="panel">
  <table id="merchants-table">
    <thead><tr><th>Merchant</th><th>Category</th><th>Charges</th><th class="amount">Total</th></tr></thead>
    <tbody></tbody>
  </table>
</div>

<h2>All transactions</h2>
<div class="panel">
  <div class="controls">
    <input id="filter-text" placeholder="Search description..." style="flex:1; min-width:200px;">
    <select id="filter-source">
      <option value="">All sources</option>
      <option value="chase_checking">Chase</option>
      <option value="boa_credit">BoA Credit</option>
      <option value="splitwise">Splitwise</option>
    </select>
    <select id="filter-category"><option value="">All categories</option></select>
    <select id="filter-flow">
      <option value="">All flows</option>
      <option value="out">Spending only</option>
      <option value="in">Income only</option>
      <option value="transfer">Transfers only</option>
      <option value="real">Spending excl. transfers</option>
    </select>
    <input id="filter-from" type="date" title="From date">
    <input id="filter-to" type="date" title="To date">
    <span id="filter-count" style="color:var(--text-dim); margin-left:auto;"></span>
  </div>
  <table id="txn-table">
    <thead>
      <tr>
        <th data-sort="date">Date</th>
        <th data-sort="source">Source</th>
        <th>Description</th>
        <th data-sort="category">Category</th>
        <th data-sort="amount" class="amount">Amount</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
</div>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
const DATA = JSON.parse(document.getElementById("payload").textContent);
const fmt = n => (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtShort = n => "$" + Math.abs(n).toLocaleString("en-US", {minimumFractionDigits:0, maximumFractionDigits:0});

document.getElementById("gen-time").textContent = DATA.generated_at.replace("T", " ").slice(0, 19) + " UTC";

// === Metric cards ===
const months = Object.keys(DATA.summary.by_month_flow).sort();
const currentMonth = months[months.length - 1];
const prevMonth = months[months.length - 2];
const cur = DATA.summary.by_month_flow[currentMonth] || {in:0, out:0, transfer:0};
const prev = DATA.summary.by_month_flow[prevMonth] || {in:0, out:0, transfer:0};

const totalSpend = Object.values(DATA.summary.by_month_flow).reduce((a, m) => a + m.out, 0);
const totalIncome = Object.values(DATA.summary.by_month_flow).reduce((a, m) => a + m.in, 0);

const cards = [
  {label: `${currentMonth} spending`, value: fmt(cur.out), cls: "bad", delta: prev.out ? `vs ${fmt(prev.out)} prev (${(((cur.out-prev.out)/prev.out)*100).toFixed(0)}%)` : ""},
  {label: `${currentMonth} income`, value: fmt(cur.in), cls: "good", delta: ""},
  {label: `${currentMonth} net`, value: fmt(cur.in - cur.out), cls: cur.in - cur.out >= 0 ? "good" : "bad", delta: ""},
  {label: "Transfers (excluded from spend)", value: fmt(cur.transfer), cls: "transfer", delta: "Zelle, CC payments, settle-ups"},
  {label: "Anomalies to review", value: DATA.anomalies.length, cls: DATA.anomalies.length > 0 ? "warn" : "good", delta: "missing Splitwise / forgotten subs"},
  {label: "Total transactions", value: DATA.transactions.length.toLocaleString(), cls: "", delta: `${DATA.summary.by_source.chase_checking||0} chase · ${DATA.summary.by_source.boa_credit||0} boa · ${DATA.summary.by_source.splitwise||0} splitwise`},
];
document.getElementById("metric-cards").innerHTML = cards.map(c =>
  `<div class="card"><div class="label">${c.label}</div><div class="value ${c.cls}">${c.value}</div><div class="delta">${c.delta}</div></div>`
).join("");

// === Anomalies ===
const anomEl = document.getElementById("anomalies");
if (DATA.anomalies.length === 0) {
  anomEl.innerHTML = '<div class="empty">Nothing suspicious. All Zelle-outs to friends have matching Splitwise activity.</div>';
} else {
  anomEl.innerHTML = DATA.anomalies.map(a => {
    const title = a.type === "missing_splitwise_entry"
      ? `${a.date} — $${Math.abs(a.amount).toFixed(2)} to ${a.recipient ? a.recipient.replace(/\b\w/g, c => c.toUpperCase()) : "?"}`
      : `Untagged subscription: ${a.merchant} ($${a.amount})`;
    return `<div class="anomaly"><div class="hdr">${title}</div><div class="hint">${a.hint}</div></div>`;
  }).join("");
}

// === Cash flow chart ===
new Chart(document.getElementById("flow-chart"), {
  type: "bar",
  data: {
    labels: months,
    datasets: [
      {label: "Income", data: months.map(m => DATA.summary.by_month_flow[m].in), backgroundColor: "#4ade80"},
      {label: "Spending", data: months.map(m => -DATA.summary.by_month_flow[m].out), backgroundColor: "#f87171"},
      {label: "Transfers", data: months.map(m => DATA.summary.by_month_flow[m].transfer), backgroundColor: "#a78bfa", hidden: true},
    ],
  },
  options: {
    responsive: true,
    plugins: { legend: { labels: { color: "#e6e8eb" } } },
    scales: {
      x: { ticks: { color: "#8b95a7" }, grid: { color: "#2d3548" } },
      y: { ticks: { color: "#8b95a7", callback: v => "$" + v }, grid: { color: "#2d3548" } },
    },
  },
});

// === Category chart (current month) ===
const curCats = DATA.summary.by_month_cat[currentMonth] || {};
const sortedCats = Object.entries(curCats).sort((a, b) => b[1] - a[1]).slice(0, 12);
new Chart(document.getElementById("cat-chart"), {
  type: "doughnut",
  data: {
    labels: sortedCats.map(c => c[0]),
    datasets: [{
      data: sortedCats.map(c => c[1]),
      backgroundColor: ["#6ba6ff","#4ade80","#fbbf24","#f87171","#a78bfa","#22d3ee","#fb923c","#84cc16","#ec4899","#14b8a6","#eab308","#6366f1"],
    }],
  },
  options: {
    plugins: {
      legend: { position: "right", labels: { color: "#e6e8eb", font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.parsed)}` } },
    },
  },
});

// === Subscriptions table ===
const subsBody = document.querySelector("#subs-table tbody");
const subs = Object.entries(DATA.summary.subscriptions).sort((a, b) => b[1].amount - a[1].amount);
if (subs.length === 0) {
  subsBody.innerHTML = '<tr><td colspan="4" class="empty">No subscriptions detected.</td></tr>';
} else {
  subsBody.innerHTML = subs.map(([k, v]) =>
    `<tr><td>${k.replace("subscription:", "")}</td><td>${v.count}</td><td class="amount">${fmt(v.amount)}</td><td>${v.last_seen}</td></tr>`
  ).join("");
}

// === Top merchants ===
document.querySelector("#merchants-table tbody").innerHTML = DATA.summary.top_merchants.map(m =>
  `<tr><td>${m.name}</td><td><span class="tag">${m.category}</span></td><td>${m.count}</td><td class="amount">${fmt(m.total)}</td></tr>`
).join("");

// === Transaction table with filters ===
const txnBody = document.querySelector("#txn-table tbody");
const filterText = document.getElementById("filter-text");
const filterSource = document.getElementById("filter-source");
const filterCategory = document.getElementById("filter-category");
const filterFlow = document.getElementById("filter-flow");
const filterFrom = document.getElementById("filter-from");
const filterTo = document.getElementById("filter-to");
const filterCount = document.getElementById("filter-count");

// Populate category filter
const cats = [...new Set(DATA.transactions.map(t => t.category))].sort();
filterCategory.innerHTML += cats.map(c => `<option value="${c}">${c}</option>`).join("");

// Default: current month, no transfers
const today = new Date();
const monthStart = currentMonth + "-01";
filterFrom.value = monthStart;
filterFlow.value = "real";

let sortKey = "date", sortDir = -1;

function applyFilters() {
  const txt = filterText.value.toLowerCase();
  const src = filterSource.value;
  const cat = filterCategory.value;
  const flow = filterFlow.value;
  const from = filterFrom.value;
  const to = filterTo.value;

  let filtered = DATA.transactions.filter(t => {
    if (txt && !t.description.toLowerCase().includes(txt)) return false;
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

  filtered.sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
  });

  const sum = filtered.reduce((a, t) => a + (t.amount || 0), 0);
  filterCount.textContent = `${filtered.length} txns · sum ${fmt(sum)}`;

  txnBody.innerHTML = filtered.slice(0, 500).map(t => {
    const amtCls = t.amount === null ? "" : t.is_transfer ? "transfer" : t.amount < 0 ? "bad" : "good";
    const flagTags = (t.flags || []).map(f => `<span class="tag ${f.includes('missing') ? 'flag-warn' : 'flag-good'}">${f}</span>`).join("");
    return `<tr>
      <td>${t.date}</td>
      <td><span class="tag">${t.source.replace("_", " ")}</span></td>
      <td>${t.description.slice(0, 90)}${flagTags}</td>
      <td><span class="tag">${t.category}</span></td>
      <td class="amount ${amtCls}">${t.amount === null ? "—" : fmt(t.amount)}</td>
    </tr>`;
  }).join("");
  if (filtered.length > 500) {
    txnBody.innerHTML += `<tr><td colspan="5" class="empty">Showing first 500 of ${filtered.length}. Refine filters to see more.</td></tr>`;
  }
}

[filterText, filterSource, filterCategory, filterFlow, filterFrom, filterTo].forEach(el => {
  el.addEventListener("input", applyFilters);
  el.addEventListener("change", applyFilters);
});

document.querySelectorAll("#txn-table th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const k = th.getAttribute("data-sort");
    if (sortKey === k) sortDir *= -1;
    else { sortKey = k; sortDir = 1; }
    applyFilters();
  });
});

applyFilters();
</script>

</body>
</html>
"""


def main():
    unified = json.loads((DATA / "unified.json").read_text(encoding="utf-8"))
    anomalies_path = DATA / "anomalies.json"
    anomalies = json.loads(anomalies_path.read_text(encoding="utf-8")) if anomalies_path.exists() else []

    summary = compute_summary(unified["transactions"])

    payload = {
        "generated_at": unified.get("generated_at", datetime.now(timezone.utc).isoformat()),
        "transactions": unified["transactions"],
        "summary": summary,
        "anomalies": anomalies,
    }

    html = HTML_TEMPLATE.replace("__PAYLOAD__", json.dumps(payload, default=str))
    OUT.write_text(html, encoding="utf-8")
    size_kb = OUT.stat().st_size // 1024
    print(f"Wrote {OUT} ({size_kb} KB)")
    print(f"  Open in browser: file:///{OUT.as_posix()}")


if __name__ == "__main__":
    main()
