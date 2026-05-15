"""CLI summary: quick answers without opening the dashboard.

Examples:
  python summary.py                      # last-30-day overview
  python summary.py --month 2026-05      # specific month
  python summary.py --category food      # filter by category prefix
  python summary.py --search costco      # search descriptions
  python summary.py --top 20             # top 20 merchants
"""
from __future__ import annotations
import argparse
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"


def load() -> dict:
    return json.loads((DATA / "unified.json").read_text(encoding="utf-8"))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--month", help="YYYY-MM filter")
    p.add_argument("--days", type=int, default=30, help="Lookback days if no --month")
    p.add_argument("--category", help="Category prefix filter (e.g. food, subscription)")
    p.add_argument("--search", help="Substring search in description")
    p.add_argument("--source", choices=["chase_checking", "boa_credit", "splitwise"])
    p.add_argument("--top", type=int, default=10, help="How many merchants to show")
    p.add_argument("--include-transfers", action="store_true", help="Include transfers in totals")
    args = p.parse_args()

    unified = load()
    txns = unified["transactions"]

    # Date filter
    if args.month:
        txns = [t for t in txns if t["date"].startswith(args.month)]
        period = args.month
    else:
        cutoff = (date.today() - timedelta(days=args.days)).isoformat()
        txns = [t for t in txns if t["date"] >= cutoff]
        period = f"last {args.days} days (since {cutoff})"

    if args.category:
        txns = [t for t in txns if t["category"].startswith(args.category)]
    if args.search:
        s = args.search.lower()
        txns = [t for t in txns if s in t["description"].lower()]
    if args.source:
        txns = [t for t in txns if t["source"] == args.source]

    if not args.include_transfers:
        txns_for_totals = [t for t in txns if not t.get("is_transfer")]
    else:
        txns_for_totals = txns

    spend = sum(abs(t["amount"]) for t in txns_for_totals if t.get("amount") and t["amount"] < 0)
    income = sum(t["amount"] for t in txns_for_totals if t.get("amount") and t["amount"] > 0)

    print(f"=== {period} ===")
    print(f"Transactions:   {len(txns)}")
    print(f"Spending:       ${spend:>10,.2f}")
    print(f"Income:         ${income:>10,.2f}")
    print(f"Net:            ${income - spend:>10,.2f}")

    by_cat = defaultdict(float)
    for t in txns_for_totals:
        amt = t.get("amount")
        if amt is None or amt >= 0:
            continue
        by_cat[t["category"]] += abs(amt)
    print(f"\nBy category:")
    for c, v in sorted(by_cat.items(), key=lambda x: -x[1])[:15]:
        bar = "█" * int(v / max(by_cat.values()) * 30) if by_cat else ""
        print(f"  {c:30s} ${v:>9,.2f}  {bar}")

    by_merch = defaultdict(lambda: {"total": 0.0, "count": 0})
    for t in txns_for_totals:
        amt = t.get("amount")
        if amt is None or amt >= 0:
            continue
        m = " ".join(t["description"].split()[:3])
        by_merch[m]["total"] += abs(amt)
        by_merch[m]["count"] += 1
    print(f"\nTop {args.top} merchants:")
    for m, v in sorted(by_merch.items(), key=lambda x: -x[1]["total"])[: args.top]:
        print(f"  {m:40s} ${v['total']:>9,.2f}  ({v['count']}x)")


if __name__ == "__main__":
    main()
