"""Reconcile transactions across Chase / BoA / Splitwise and flag anomalies.

Links transactions that are the same real-world event seen from different sources
so we don't double-count, then flags Chase Zelle-outs that lack a matching
Splitwise entry (likely "I forgot to log this on Splitwise").

Output: data/unified.json gets enriched with `link_id` and `flags` fields.
A separate data/anomalies.json lists things that need attention.
"""
from __future__ import annotations
import json
import re
import uuid
from datetime import date, timedelta
from pathlib import Path

DATA = Path(__file__).parent / "data"

CC_PAYMENT_CONF_RE = re.compile(r"bank of america payment\s+(\w+)", re.I)
BOA_PAYMENT_CONF_RE = re.compile(r"online/mobile payment\s+conf#(\w+)", re.I)
ZELLE_TO_RE = re.compile(r"zelle payment to\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+[A-Z0-9]{8,}|$)", re.I)
ZELLE_FROM_RE = re.compile(r"zelle payment from\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s+\d|$)", re.I)


def parse_date(s: str) -> date | None:
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def days_between(a: str, b: str) -> int:
    da, db = parse_date(a), parse_date(b)
    if da is None or db is None:
        return 999
    return abs((da - db).days)


def reconcile_cc_payments(txns: list[dict]) -> int:
    """Link Chase 'Bank of America Payment <CONF>' to BoA 'ONLINE/MOBILE PAYMENT CONF#<CONF>'."""
    chase_payments = []
    boa_payments = []
    for t in txns:
        if t["source"] == "chase_checking":
            m = CC_PAYMENT_CONF_RE.search(t["description"])
            if m:
                chase_payments.append((m.group(1).lower(), t))
        elif t["source"] == "boa_credit":
            m = BOA_PAYMENT_CONF_RE.search(t["description"])
            if m:
                boa_payments.append((m.group(1).lower(), t))

    linked = 0
    for conf, ct in chase_payments:
        for bconf, bt in boa_payments:
            if conf == bconf:
                link = f"ccpay-{conf}"
                ct.setdefault("flags", []).append("cc_payment_matched")
                bt.setdefault("flags", []).append("cc_payment_matched")
                ct["link_id"] = link
                bt["link_id"] = link
                linked += 1
                break
    return linked


def extract_zelle_name(description: str, direction: str) -> str | None:
    pat = ZELLE_TO_RE if direction == "to" else ZELLE_FROM_RE
    m = pat.search(description)
    if not m:
        return None
    name = m.group(1).strip()
    # Normalize: strip trailing single letters / IDs
    name = re.sub(r"\s+[A-Z][a-z]?\d+\w*$", "", name).strip()
    return name.lower()


def reconcile_splitwise_settles(txns: list[dict], splitwise_friends: list[dict]) -> int:
    """Link Chase Zelle to/from Splitwise settle-up payments by name + amount + date."""
    # Build name lookup from Splitwise friends
    friend_names = {}
    for f in splitwise_friends:
        full = f"{f.get('first_name','') or ''} {f.get('last_name','') or ''}".strip().lower()
        if full:
            friend_names[full] = f["id"]
            # also index by first name
            first = (f.get("first_name") or "").lower()
            if first and first not in friend_names:
                friend_names[first] = f["id"]

    linked = 0
    sw_settles = [t for t in txns if t["source"] == "splitwise" and t["category"] == "transfer:splitwise_settle"]
    chase_zelles = [t for t in txns if t["source"] == "chase_checking" and t["category"] in ("transfer:zelle_out", "income:zelle_in")]

    for ct in chase_zelles:
        direction = "to" if ct["category"] == "transfer:zelle_out" else "from"
        name = extract_zelle_name(ct["description"], direction)
        if not name:
            continue
        ct_amount = abs(ct["amount"])
        for st in sw_settles:
            # description on Splitwise settle is usually "X paid Y" — fall back to amount + date
            if days_between(ct["date"], st["date"]) > 5:
                continue
            st_amount = abs(st.get("paid_by_you", 0)) + abs(st.get("your_share", 0)) or abs(st["amount"])
            if abs(ct_amount - st_amount) < 0.5:
                # Also check name appears in description
                if name.split()[0] in st["description"].lower():
                    link = f"settle-{uuid.uuid4().hex[:8]}"
                    ct["link_id"] = link
                    st["link_id"] = link
                    ct.setdefault("flags", []).append("splitwise_settled")
                    st.setdefault("flags", []).append("splitwise_settled")
                    linked += 1
                    break
    return linked


def find_missing_splitwise(txns: list[dict], splitwise_friends: list[dict], lookback_days: int = 7) -> list[dict]:
    """Flag Chase Zelle-outs to friends with no matching Splitwise activity in ±lookback_days."""
    friend_first_names = set()
    for f in splitwise_friends:
        if f.get("first_name"):
            friend_first_names.add(f["first_name"].lower())

    sw_by_date: dict[str, list[dict]] = {}
    for t in txns:
        if t["source"] != "splitwise":
            continue
        d = parse_date(t["date"])
        if d:
            sw_by_date.setdefault(t["date"], []).append(t)

    anomalies = []
    for ct in txns:
        if ct["source"] != "chase_checking":
            continue
        if ct["category"] != "transfer:zelle_out":
            continue
        if abs(ct["amount"]) < 20:  # skip small amounts
            continue
        if "splitwise_settled" in ct.get("flags", []):
            continue  # already linked

        name = extract_zelle_name(ct["description"], "to")
        if not name:
            continue
        first = name.split()[0]

        # Search Splitwise activity within ±lookback_days for this person's name appearing
        ct_date = parse_date(ct["date"])
        if not ct_date:
            continue

        found = False
        for offset in range(-lookback_days, lookback_days + 1):
            check_date = (ct_date + timedelta(days=offset)).isoformat()
            for swt in sw_by_date.get(check_date, []):
                # Either the description mentions the person, or the user's share matches
                if first in swt["description"].lower():
                    found = True
                    break
                if abs(abs(swt["amount"]) - abs(ct["amount"])) < 0.5:
                    found = True
                    break
            if found:
                break

        if not found and first in friend_first_names:
            anomalies.append({
                "type": "missing_splitwise_entry",
                "severity": "medium",
                "date": ct["date"],
                "amount": ct["amount"],
                "description": ct["description"],
                "recipient": name,
                "hint": f"You sent ${abs(ct['amount']):.2f} to {first.title()} but no Splitwise expense involving them appears within +/-{lookback_days} days. Did you forget to log it?",
            })
            ct.setdefault("flags", []).append("possibly_missing_splitwise")

    return anomalies


def find_potential_subscriptions(txns: list[dict]) -> list[dict]:
    """Find merchants charging the same amount on a roughly-monthly cadence
    that aren't tagged as subscriptions."""
    from collections import defaultdict
    by_merchant: dict[tuple, list[dict]] = defaultdict(list)
    EXCLUDE_PREFIXES = ("zelle ", "online/mobile", "bank of america", "fedwire", "domestic incoming", "card purchase return")
    for t in txns:
        if t["source"] == "splitwise":
            continue
        if t["category"].startswith("subscription:") or t.get("is_transfer"):
            continue
        if t.get("amount") is None or t["amount"] >= 0:
            continue
        desc_lower = t["description"].lower()
        if any(desc_lower.startswith(p) for p in EXCLUDE_PREFIXES):
            continue
        # Derive merchant key: first 3 words of description, plus rounded amount
        merchant = " ".join(desc_lower.split()[:3])
        amt = round(abs(t["amount"]), 2)
        by_merchant[(merchant, amt)].append(t)

    suspects = []
    for (merchant, amt), occurrences in by_merchant.items():
        if len(occurrences) < 2:
            continue
        # Check spacing — at least one pair spaced 25-35 days apart
        dates = sorted(d for d in (parse_date(t["date"]) for t in occurrences) if d is not None)
        for i in range(1, len(dates)):
            gap = (dates[i] - dates[i - 1]).days
            if 25 <= gap <= 35:
                suspects.append({
                    "type": "untagged_subscription",
                    "severity": "low",
                    "merchant": merchant,
                    "amount": amt,
                    "occurrences": len(occurrences),
                    "dates": [d.isoformat() for d in dates],
                    "hint": f"'{merchant}' charged ${amt} on {len(occurrences)} occasions ~monthly. Possibly a subscription you forgot about.",
                })
                break
    return suspects


def main():
    unified = json.loads((DATA / "unified.json").read_text(encoding="utf-8"))
    splitwise = json.loads((DATA / "splitwise.json").read_text(encoding="utf-8"))
    txns = unified["transactions"]
    friends = splitwise.get("friends", [])

    cc_links = reconcile_cc_payments(txns)
    settle_links = reconcile_splitwise_settles(txns, friends)
    missing = find_missing_splitwise(txns, friends)
    subs = find_potential_subscriptions(txns)

    anomalies = missing + subs

    # Persist
    unified["reconciliation"] = {
        "cc_payments_linked": cc_links,
        "splitwise_settles_linked": settle_links,
        "anomaly_count": len(anomalies),
    }
    (DATA / "unified.json").write_text(json.dumps(unified, indent=2, default=str), encoding="utf-8")
    (DATA / "anomalies.json").write_text(json.dumps(anomalies, indent=2, default=str), encoding="utf-8")

    print(f"CC payments linked:        {cc_links}")
    print(f"Splitwise settles linked:  {settle_links}")
    print(f"Missing Splitwise entries: {len(missing)}")
    print(f"Untagged subscriptions:    {len(subs)}")
    print(f"\nWrote data/unified.json (enriched) and data/anomalies.json")


if __name__ == "__main__":
    main()
