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
<title>Wealth Ledger &middot; Money Maker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root {
  --parch:        #f4ecd8;
  --parch-deep:   #ebe1c5;
  --parch-light:  #faf3df;
  --parch-warm:   #f0e6cc;
  --ink:          #1c1814;
  --ink-soft:     #4f463a;
  --ink-mute:     #847762;
  --gold:         #a78240;
  --gold-bright:  #c4a062;
  --gold-pale:    #d6bf85;
  --gold-deep:    #7a5d2a;
  --green:        #1a3d2e;
  --green-soft:   #2e5a47;
  --green-deep:   #0d2820;
  --claret:       #6e1f2a;
  --claret-soft:  #9a4651;
  --rule:         color-mix(in srgb, var(--gold) 45%, transparent);
  --rule-faint:   color-mix(in srgb, var(--gold) 18%, transparent);
  --shadow-card:  0 1px 0 rgba(28, 24, 20, .04), 0 8px 24px -10px rgba(28, 24, 20, .12);
  --shadow-soft:  0 1px 0 rgba(28, 24, 20, .03), 0 2px 8px -2px rgba(28, 24, 20, .06);
  --noise:        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.11  0 0 0 0 0.09  0 0 0 0 0.07  0 0 0 0.045 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--gold) 10%, transparent), transparent 60%),
    radial-gradient(900px 500px at 90% 110%, color-mix(in srgb, var(--green) 8%, transparent), transparent 60%),
    var(--parch);
  color: var(--ink);
  font-family: "Manrope", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.55;
  font-feature-settings: "liga", "kern";
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: var(--noise);
  background-size: 240px 240px;
  pointer-events: none;
  opacity: .55;
  mix-blend-mode: multiply;
  z-index: 0;
}
.wrap { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 64px 48px 96px; }

/* === HEADER === */
.crest {
  text-align: center;
  margin-bottom: 32px;
  animation: fade-up .9s cubic-bezier(.2,.8,.2,1) both;
}
.monogram {
  display: inline-block;
  width: 56px; height: 56px; line-height: 54px;
  border: 1px solid var(--gold);
  border-radius: 50%;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 700;
  font-size: 22px;
  color: var(--gold-deep);
  background: var(--parch-light);
  letter-spacing: .04em;
  position: relative;
}
.monogram::before, .monogram::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 80px; height: 1px;
  background: linear-gradient(to right, transparent, var(--gold) 30%, var(--gold) 70%, transparent);
}
.monogram::before { right: calc(100% + 16px); }
.monogram::after  { left:  calc(100% + 16px); }

h1.title {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(48px, 6vw, 72px);
  letter-spacing: -.01em;
  text-align: center;
  margin: 28px 0 8px;
  color: var(--ink);
  line-height: 1;
}
h1.title em {
  font-style: italic;
  color: var(--gold-deep);
  font-weight: 600;
}
.subtitle {
  text-align: center;
  text-transform: uppercase;
  letter-spacing: .35em;
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-mute);
  margin: 0 0 24px;
}
.dateline {
  text-align: center;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 16px;
  color: var(--ink-soft);
  margin: 0;
}
.fancy-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 36px 0 56px;
  gap: 14px;
  color: var(--gold);
}
.fancy-rule::before, .fancy-rule::after {
  content: "";
  flex: 1;
  max-width: 380px;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--gold), transparent);
}
.fancy-rule .ornament {
  font-size: 10px;
  letter-spacing: .8em;
  color: var(--gold);
}

/* === METRIC CARDS === */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--rule-faint);
  border: 1px solid var(--rule);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
@media (max-width: 900px) { .cards { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .cards { grid-template-columns: 1fr; } }

.card {
  background: var(--parch-light);
  padding: 26px 28px 24px;
  position: relative;
  transition: background .25s ease;
  animation: fade-up .9s cubic-bezier(.2,.8,.2,1) both;
}
.card:hover { background: var(--parch-warm); }
.card:nth-child(1) { animation-delay: .05s; }
.card:nth-child(2) { animation-delay: .10s; }
.card:nth-child(3) { animation-delay: .15s; }
.card:nth-child(4) { animation-delay: .20s; }
.card:nth-child(5) { animation-delay: .25s; }
.card:nth-child(6) { animation-delay: .30s; }

.card .label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .25em;
  text-transform: uppercase;
  color: var(--gold-deep);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card .label::before {
  content: "";
  width: 18px; height: 1px; background: var(--gold);
}
.card .value {
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  font-size: 30px;
  letter-spacing: -.02em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.card .value .sigil {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 500;
  font-size: 26px;
  color: var(--gold);
  margin-right: 2px;
}
.card .delta {
  margin-top: 10px;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 13px;
  color: var(--ink-mute);
  line-height: 1.4;
}
.tone-good   .value { color: var(--green); }
.tone-bad    .value { color: var(--claret); }
.tone-warn   .value { color: var(--gold-deep); }
.tone-neutral .value { color: var(--ink); }

/* === SECTIONS === */
section.block { margin-top: 56px; animation: fade-up .9s cubic-bezier(.2,.8,.2,1) both; }
.section-head {
  display: flex;
  align-items: baseline;
  gap: 18px;
  margin-bottom: 22px;
}
.section-head .roman {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 600;
  font-size: 32px;
  color: var(--gold-deep);
  line-height: 1;
  flex-shrink: 0;
  min-width: 64px;
}
.section-head .title {
  font-family: "Manrope", sans-serif;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: .3em;
  text-transform: uppercase;
  color: var(--ink);
  white-space: nowrap;
}
.section-head .rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, var(--gold) 0%, var(--rule-faint) 100%);
  position: relative;
  margin-left: 8px;
}
.section-head .rule::after {
  content: "";
  position: absolute; right: 0; top: 50%;
  width: 6px; height: 6px;
  background: var(--gold);
  transform: translateY(-50%) rotate(45deg);
}

.panel {
  background: var(--parch-light);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 28px 32px;
  box-shadow: var(--shadow-soft);
}
.grid-2 { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; }
@media (max-width: 1000px) { .grid-2 { grid-template-columns: 1fr; } }

/* === ANOMALIES === */
.anomaly {
  position: relative;
  padding: 16px 22px 16px 30px;
  background: linear-gradient(to right, color-mix(in srgb, var(--claret) 5%, var(--parch-light)) 0%, var(--parch-light) 80%);
  border-top: 1px solid var(--rule-faint);
}
.anomaly:first-child { border-top: none; }
.anomaly::before {
  content: "";
  position: absolute;
  left: 0; top: 14px; bottom: 14px;
  width: 3px;
  background: var(--claret);
}
.anomaly .num {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 600;
  color: var(--claret);
  font-size: 18px;
  margin-right: 10px;
}
.anomaly .hdr {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-weight: 600;
  color: var(--claret);
  font-size: 17px;
  margin-bottom: 4px;
}
.anomaly .hint {
  color: var(--ink-soft);
  font-size: 13.5px;
  line-height: 1.55;
}
.empty {
  padding: 32px 16px;
  text-align: center;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 18px;
  color: var(--green);
}
.empty::before, .empty::after { content: "\2014"; color: var(--gold); margin: 0 12px; }

/* === TABLES === */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left;
  font-family: "Manrope", sans-serif;
  font-weight: 600;
  font-size: 10px;
  letter-spacing: .25em;
  text-transform: uppercase;
  color: var(--gold-deep);
  padding: 10px 12px 14px;
  border-bottom: 1px solid var(--gold);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
th:hover { color: var(--ink); }
td {
  padding: 12px;
  border-bottom: 1px solid var(--rule-faint);
  vertical-align: middle;
  color: var(--ink-soft);
}
tbody tr:hover td { background: color-mix(in srgb, var(--gold) 5%, var(--parch-light)); color: var(--ink); }
.amount {
  text-align: right;
  font-family: "JetBrains Mono", monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--ink);
  white-space: nowrap;
}
.amount.bad  { color: var(--claret); }
.amount.good { color: var(--green); }
.amount.transfer { color: var(--gold-deep); }
.merchant-name { font-weight: 500; color: var(--ink); }
.subscription-name {
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 16px;
  color: var(--ink);
}
.date-cell { font-family: "JetBrains Mono", monospace; font-size: 12px; color: var(--ink-mute); white-space: nowrap; }

.tag {
  display: inline-block;
  padding: 2px 9px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: .15em;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  color: var(--gold-deep);
  border: 1px solid var(--rule);
  border-radius: 2px;
}
.tag.flag-warn { background: color-mix(in srgb, var(--claret) 12%, transparent); color: var(--claret); border-color: color-mix(in srgb, var(--claret) 30%, transparent); }
.tag.flag-good { background: color-mix(in srgb, var(--green) 10%, transparent); color: var(--green); border-color: color-mix(in srgb, var(--green) 30%, transparent); }
.tag.src { background: var(--parch-deep); color: var(--ink-soft); }

/* === CONTROLS === */
.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
  align-items: center;
  padding: 14px 16px;
  background: var(--parch-warm);
  border: 1px solid var(--rule);
  border-radius: 4px;
}
.controls input, .controls select {
  background: var(--parch-light);
  color: var(--ink);
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: 7px 12px;
  font-size: 13px;
  font-family: "Manrope", sans-serif;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.controls input:focus, .controls select:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 18%, transparent);
}
.controls input::placeholder { color: var(--ink-mute); font-style: italic; }
.filter-count {
  margin-left: auto;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 14px;
  color: var(--ink-soft);
}
.filter-count strong { color: var(--ink); font-weight: 600; }

canvas { max-width: 100%; }

/* === FOOTER === */
footer {
  margin-top: 88px;
  text-align: center;
  font-family: "Cormorant Garamond", serif;
  font-style: italic;
  font-size: 13px;
  color: var(--ink-mute);
}
footer .rule { width: 240px; height: 1px; background: var(--rule); margin: 0 auto 18px; }
footer .mark { color: var(--gold-deep); letter-spacing: .15em; font-size: 11px; text-transform: uppercase; font-style: normal; font-family: "Manrope"; font-weight: 600; margin-top: 6px; }

@keyframes fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

::selection { background: color-mix(in srgb, var(--gold) 35%, transparent); color: var(--ink); }
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--parch); }
::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--gold) 40%, transparent); border-radius: 0; border: 3px solid var(--parch); }
::-webkit-scrollbar-thumb:hover { background: var(--gold); }
</style>
</head>
<body>
<div class="wrap">

<header class="crest">
  <span class="monogram">M&middot;M</span>
  <h1 class="title">Wealth <em>Ledger</em></h1>
  <p class="subtitle">A private statement of accounts</p>
  <p class="dateline" id="dateline">&nbsp;</p>
  <div class="fancy-rule"><span class="ornament">&#x25C6; &#x25C6; &#x25C6;</span></div>
</header>

<div class="cards" id="metric-cards"></div>

<section class="block">
  <div class="section-head"><span class="roman">I.</span><span class="title">Items Requiring Attention</span><span class="rule"></span></div>
  <div class="panel" id="anomalies"></div>
</section>

<section class="block">
  <div class="section-head"><span class="roman">II.</span><span class="title">Cash Flow by Month</span><span class="rule"></span></div>
  <div class="panel"><canvas id="flow-chart" height="100"></canvas></div>
</section>

<div class="grid-2">
  <section class="block">
    <div class="section-head"><span class="roman">III.</span><span class="title">Spending by Category</span><span class="rule"></span></div>
    <div class="panel"><canvas id="cat-chart" height="240"></canvas></div>
  </section>
  <section class="block">
    <div class="section-head"><span class="roman">IV.</span><span class="title">Standing Orders</span><span class="rule"></span></div>
    <div class="panel">
      <table id="subs-table">
        <thead><tr><th>Subscription</th><th>Charges</th><th class="amount">Total</th><th>Last seen</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </section>
</div>

<section class="block">
  <div class="section-head"><span class="roman">V.</span><span class="title">Principal Vendors</span><span class="rule"></span></div>
  <div class="panel">
    <table id="merchants-table">
      <thead><tr><th>Vendor</th><th>Category</th><th>Charges</th><th class="amount">Total</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
</section>

<section class="block">
  <div class="section-head"><span class="roman">VI.</span><span class="title">Ledger Entries</span><span class="rule"></span></div>
  <div class="panel">
    <div class="controls">
      <input id="filter-text" placeholder="Search description..." style="flex:1; min-width:200px;">
      <select id="filter-source">
        <option value="">All accounts</option>
        <option value="chase_checking">Chase Checking</option>
        <option value="boa_credit">B. of America Credit</option>
        <option value="splitwise">Splitwise</option>
      </select>
      <select id="filter-category"><option value="">All categories</option></select>
      <select id="filter-flow">
        <option value="">All flows</option>
        <option value="out">Expenditures only</option>
        <option value="in">Receipts only</option>
        <option value="transfer">Transfers only</option>
        <option value="real">Expenditures (excl. transfers)</option>
      </select>
      <input id="filter-from" type="date" title="From date">
      <input id="filter-to" type="date" title="To date">
      <span class="filter-count" id="filter-count"></span>
    </div>
    <table id="txn-table">
      <thead>
        <tr>
          <th data-sort="date">Date</th>
          <th data-sort="source">Account</th>
          <th>Description</th>
          <th data-sort="category">Category</th>
          <th data-sort="amount" class="amount">Amount</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
</section>

<footer>
  <div class="rule"></div>
  Compiled <span id="gen-time"></span>
  <div class="mark">M &middot; M &nbsp;&middot;&nbsp; Anno Domini MMXXVI</div>
</footer>

</div>

<script id="payload" type="application/json">__PAYLOAD__</script>
<script>
const DATA = JSON.parse(document.getElementById("payload").textContent);

const PALETTE = {
  green: "#1a3d2e", greenSoft: "#2e5a47", greenPale: "#5a7e6c",
  gold: "#a78240", goldBright: "#c4a062", goldPale: "#d6bf85", goldDeep: "#7a5d2a",
  claret: "#6e1f2a", claretSoft: "#9a4651",
  ink: "#1c1814", inkSoft: "#4f463a", inkMute: "#847762",
  parch: "#f4ecd8", parchLight: "#faf3df", rule: "rgba(167,130,64,.25)",
};
const CHART_COLORS = [
  PALETTE.green, PALETTE.gold, PALETTE.claret, PALETTE.greenSoft,
  PALETTE.goldBright, PALETTE.claretSoft, PALETTE.greenPale, PALETTE.goldDeep,
  PALETTE.goldPale, "#3d5942", "#876840", "#a55a64",
];

Chart.defaults.font.family = "Manrope, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = PALETTE.inkSoft;
Chart.defaults.borderColor = PALETTE.rule;

const fmt = n => {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
};
const fmtSplit = n => {
  const abs = Math.abs(n).toLocaleString("en-US", {minimumFractionDigits:2, maximumFractionDigits:2});
  return { sigil: n < 0 ? "-$" : "$", num: abs };
};

const now = new Date();
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function toRoman(n) {
  if (!n) return "";
  const map = [["M",1000],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]];
  let r = ""; for (const [s, v] of map) { while (n >= v) { r += s; n -= v; } } return r;
}
document.getElementById("dateline").textContent =
  `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} — Anno Domini ${toRoman(now.getFullYear())}`;

document.getElementById("gen-time").textContent =
  DATA.generated_at.replace("T", " ").slice(0, 16) + " UTC";

// === Metric cards ===
const monthsKeys = Object.keys(DATA.summary.by_month_flow).sort();
const currentMonth = monthsKeys[monthsKeys.length - 1];
const prevMonth = monthsKeys[monthsKeys.length - 2];
const cur = DATA.summary.by_month_flow[currentMonth] || {in:0, out:0, transfer:0};
const prev = DATA.summary.by_month_flow[prevMonth] || {in:0, out:0, transfer:0};
const monthLabel = currentMonth ? `${months[parseInt(currentMonth.slice(5,7))-1]} ${currentMonth.slice(0,4)}` : "";

const deltaPct = prev.out > 0 ? ((cur.out - prev.out) / prev.out * 100) : null;
const deltaText = deltaPct === null ? "" :
  (deltaPct >= 0 ? `+${deltaPct.toFixed(0)}% vs prior month` : `${deltaPct.toFixed(0)}% vs prior month`);

const cards = [
  {label: "Expended", tone: "bad", value: fmtSplit(-cur.out), delta: `${monthLabel}. ${deltaText}`},
  {label: "Received", tone: "good", value: fmtSplit(cur.in), delta: `${monthLabel}. Wire, Zelle &amp; refunds.`},
  {label: "Net Position", tone: cur.in - cur.out >= 0 ? "good" : "bad", value: fmtSplit(cur.in - cur.out), delta: `${monthLabel}. Receipts less expenditures.`},
  {label: "Transfers", tone: "warn", value: fmtSplit(cur.transfer), delta: "Movements between own accounts &amp; settle-ups."},
  {label: "Items to Review", tone: DATA.anomalies.length ? "warn" : "good", value: {sigil:"", num: toRoman(DATA.anomalies.length) || "0"}, delta: "Suspected omissions on Splitwise &amp; untagged charges."},
  {label: "Total Entries", tone: "neutral", value: {sigil:"", num: DATA.transactions.length.toLocaleString()}, delta: `${(DATA.summary.by_source.chase_checking||0)} Chase &middot; ${(DATA.summary.by_source.boa_credit||0)} BoA &middot; ${(DATA.summary.by_source.splitwise||0)} Splitwise`},
];
document.getElementById("metric-cards").innerHTML = cards.map(c =>
  `<div class="card tone-${c.tone}">
    <div class="label">${c.label}</div>
    <div class="value">${c.value.sigil ? `<span class="sigil">${c.value.sigil}</span>` : ""}<span>${c.value.num}</span></div>
    <div class="delta">${c.delta}</div>
  </div>`
).join("");

// === Anomalies ===
const anomEl = document.getElementById("anomalies");
if (DATA.anomalies.length === 0) {
  anomEl.innerHTML = '<div class="empty">All accounts in good order</div>';
} else {
  anomEl.innerHTML = DATA.anomalies.map((a, i) => {
    const num = toRoman(i + 1);
    const recipient = a.recipient ? a.recipient.replace(/\b\w/g, c => c.toUpperCase()) : "";
    const title = a.type === "missing_splitwise_entry"
      ? `${a.date} — $${Math.abs(a.amount).toFixed(2)} to ${recipient}`
      : `Untagged recurring charge: ${a.merchant} ($${a.amount})`;
    return `<div class="anomaly"><div class="hdr"><span class="num">${num}.</span>${title}</div><div class="hint">${a.hint}</div></div>`;
  }).join("");
}

// === Cash flow chart ===
new Chart(document.getElementById("flow-chart"), {
  type: "bar",
  data: {
    labels: monthsKeys,
    datasets: [
      {label: "Receipts", data: monthsKeys.map(m => DATA.summary.by_month_flow[m].in), backgroundColor: PALETTE.green, borderRadius: 2, borderSkipped: false},
      {label: "Expenditures", data: monthsKeys.map(m => -DATA.summary.by_month_flow[m].out), backgroundColor: PALETTE.claret, borderRadius: 2, borderSkipped: false},
      {label: "Transfers", data: monthsKeys.map(m => DATA.summary.by_month_flow[m].transfer), backgroundColor: PALETTE.gold, borderRadius: 2, borderSkipped: false, hidden: true},
    ],
  },
  options: {
    responsive: true,
    plugins: {
      legend: { labels: { color: PALETTE.inkSoft, font: {family:"Manrope", size: 11, weight: "500"}, usePointStyle: true, pointStyle: "rectRounded", padding: 16 } },
      tooltip: {
        backgroundColor: PALETTE.parchLight, titleColor: PALETTE.ink, bodyColor: PALETTE.inkSoft,
        borderColor: PALETTE.gold, borderWidth: 1, padding: 12, cornerRadius: 2,
        titleFont: {family:"Cormorant Garamond", style:"italic", size: 14, weight: "600"},
        bodyFont: {family:"JetBrains Mono", size: 12},
        callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { ticks: { color: PALETTE.inkMute }, grid: { display: false }, border: { color: PALETTE.rule } },
      y: { ticks: { color: PALETTE.inkMute, callback: v => "$" + Math.abs(v).toLocaleString() }, grid: { color: PALETTE.rule, drawTicks: false }, border: { display: false } },
    },
  },
});

// === Category donut ===
const curCats = DATA.summary.by_month_cat[currentMonth] || {};
const sortedCats = Object.entries(curCats).sort((a, b) => b[1] - a[1]).slice(0, 12);
new Chart(document.getElementById("cat-chart"), {
  type: "doughnut",
  data: {
    labels: sortedCats.map(c => c[0]),
    datasets: [{
      data: sortedCats.map(c => c[1]),
      backgroundColor: CHART_COLORS,
      borderColor: PALETTE.parchLight,
      borderWidth: 2,
      hoverBorderColor: PALETTE.gold,
    }],
  },
  options: {
    cutout: "60%",
    plugins: {
      legend: { position: "right", labels: { color: PALETTE.inkSoft, font: {family:"Manrope", size: 11}, padding: 10, boxWidth: 10, boxHeight: 10 } },
      tooltip: {
        backgroundColor: PALETTE.parchLight, titleColor: PALETTE.ink, bodyColor: PALETTE.inkSoft,
        borderColor: PALETTE.gold, borderWidth: 1, padding: 12, cornerRadius: 2,
        titleFont: {family:"Cormorant Garamond", style:"italic", size: 14, weight: "600"},
        bodyFont: {family:"JetBrains Mono", size: 12},
        callbacks: { label: ctx => `${ctx.label}: ${fmt(ctx.parsed)}` },
      },
    },
  },
});

// === Subscriptions ===
const subsBody = document.querySelector("#subs-table tbody");
const subs = Object.entries(DATA.summary.subscriptions).sort((a, b) => b[1].amount - a[1].amount);
if (subs.length === 0) {
  subsBody.innerHTML = '<tr><td colspan="4" class="empty" style="padding:18px;">No standing orders detected</td></tr>';
} else {
  subsBody.innerHTML = subs.map(([k, v]) => `
    <tr>
      <td><span class="subscription-name">${k.replace("subscription:", "")}</span></td>
      <td>${v.count}</td>
      <td class="amount">${fmt(v.amount)}</td>
      <td class="date-cell">${v.last_seen}</td>
    </tr>`).join("");
}

// === Top vendors ===
document.querySelector("#merchants-table tbody").innerHTML = DATA.summary.top_merchants.map(m =>
  `<tr>
    <td><span class="merchant-name">${m.name}</span></td>
    <td><span class="tag">${m.category}</span></td>
    <td>${m.count}</td>
    <td class="amount">${fmt(m.total)}</td>
  </tr>`
).join("");

// === Ledger Entries ===
const txnBody = document.querySelector("#txn-table tbody");
const filterText = document.getElementById("filter-text");
const filterSource = document.getElementById("filter-source");
const filterCategory = document.getElementById("filter-category");
const filterFlow = document.getElementById("filter-flow");
const filterFrom = document.getElementById("filter-from");
const filterTo = document.getElementById("filter-to");
const filterCount = document.getElementById("filter-count");

const cats = [...new Set(DATA.transactions.map(t => t.category))].sort();
filterCategory.innerHTML += cats.map(c => `<option value="${c}">${c}</option>`).join("");

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
  filterCount.innerHTML = `<strong>${filtered.length}</strong> entries &middot; sum <strong>${fmt(sum)}</strong>`;

  const sourceLabel = {chase_checking: "Chase", boa_credit: "BoA", splitwise: "Splitwise"};

  txnBody.innerHTML = filtered.slice(0, 500).map(t => {
    const amtCls = t.amount === null ? "" : t.is_transfer ? "transfer" : t.amount < 0 ? "bad" : "good";
    const flagTags = (t.flags || []).map(f => `<span class="tag ${f.includes('missing') ? 'flag-warn' : 'flag-good'}" style="margin-left:6px;">${f}</span>`).join("");
    return `<tr>
      <td class="date-cell">${t.date}</td>
      <td><span class="tag src">${sourceLabel[t.source] || t.source}</span></td>
      <td>${t.description.slice(0, 90)}${flagTags}</td>
      <td><span class="tag">${t.category}</span></td>
      <td class="amount ${amtCls}">${t.amount === null ? "—" : fmt(t.amount)}</td>
    </tr>`;
  }).join("");
  if (filtered.length > 500) {
    txnBody.innerHTML += `<tr><td colspan="5" class="empty" style="padding:14px;">First 500 of ${filtered.length} shown. Refine filters to see more.</td></tr>`;
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
