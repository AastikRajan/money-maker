"""Build a unified dataset from chase.json + boa.json + splitwise.json.

Output schema (data/unified.json):
{
  "generated_at": "...",
  "sources": {...counts...},
  "transactions": [
     {
       "date": "YYYY-MM-DD",
       "source": "chase_checking" | "boa_credit" | "splitwise",
       "description": "...",
       "amount": float (negative = money out, positive = money in),
       "category": "..." (rule-based),
       "is_transfer": bool,
       "raw": {...source-specific fields...}
     }
  ]
}
"""
from __future__ import annotations
import json
import re
from datetime import datetime, timezone
from pathlib import Path

DATA = Path(__file__).parent / "data"

# --- Categorization rules: order matters; first match wins ---
CATEGORY_RULES = [
    # Transfers (money moving between your own accounts / paying off CC)
    (re.compile(r"bank of america payment", re.I), "transfer:cc_payment", True),
    (re.compile(r"online/mobile payment", re.I), "transfer:cc_payment", True),
    (re.compile(r"fedwire credit|domestic incoming wire", re.I), "income:wire", False),
    (re.compile(r"zelle payment from", re.I), "income:zelle_in", False),
    (re.compile(r"zelle payment to", re.I), "transfer:zelle_out", True),
    (re.compile(r"cash rewards statement credit", re.I), "income:rewards", False),
    (re.compile(r"card purchase return", re.I), "income:refund", False),
    # Subscriptions
    (re.compile(r"claude\.?ai|anthropic", re.I), "subscription:ai", False),
    (re.compile(r"perplexity", re.I), "subscription:ai", False),
    (re.compile(r"apple\.com/bill", re.I), "subscription:apple", False),
    (re.compile(r"regalcinemasunlimited", re.I), "subscription:movies", False),
    (re.compile(r"uber.*one membership", re.I), "subscription:uber_one", False),
    (re.compile(r"rocket money", re.I), "subscription:other", False),
    (re.compile(r"recurring card purchase", re.I), "subscription:other", False),
    # Groceries
    (re.compile(r"costco|trader joe|harris teeter|giant|whole ?fds|whole foods|district mart", re.I), "groceries", False),
    # Food & dining
    (re.compile(r"starbucks|chipotle|mcdonald|taco bell|raising canes|olive garden|insomnia cookies|bin 14|park plaza|rajaji|coachrun|charmpass", re.I), "food:dining", False),
    (re.compile(r"uber\s*\*?\s*eats|doordash|grubhub", re.I), "food:delivery", False),
    (re.compile(r"hopkins bloomberg|sq \*2393", re.I), "food:dining", False),
    # Transport
    (re.compile(r"uber|lyft|capbike", re.I), "transport:rideshare", False),
    (re.compile(r"hopp/", re.I), "transport:other", False),
    # Shopping
    (re.compile(r"amazon mktpl|amzn\.com", re.I), "shopping:amazon", False),
    # Vape/tobacco
    (re.compile(r"tobacco|vape|smoke", re.I), "personal:vape", False),
    # Movies/entertainment
    (re.compile(r"regal cinemas", re.I), "entertainment:movies", False),
    # Office/business
    (re.compile(r"minuteman press", re.I), "business:office", False),
    # Bank fees
    (re.compile(r"wire fee|overdraft fee|interest charged", re.I), "fee:bank", False),
]


def categorize(description: str) -> tuple[str, bool]:
    for pat, cat, is_transfer in CATEGORY_RULES:
        if pat.search(description):
            return cat, is_transfer
    return "uncategorized", False


def normalize_chase(statements: list[dict]) -> list[dict]:
    out = []
    for stmt in statements:
        for t in stmt["transactions"]:
            cat, is_transfer = categorize(t["description"])
            out.append({
                "date": t["date"],
                "source": "chase_checking",
                "description": t["description"],
                "amount": t["amount"],
                "balance_after": t.get("balance"),
                "category": cat,
                "is_transfer": is_transfer,
                "raw": t,
            })
    return out


def normalize_boa(statements: list[dict]) -> list[dict]:
    out = []
    for stmt in statements:
        for t in stmt["transactions"]:
            # In BoA credit-card statements:
            #   "credit" section amounts are printed as negative (reducing balance owed)
            #   "purchase" section amounts are positive
            # We flip signs so negative = money OUT of your pocket (purchase),
            # positive = money IN (refund / payment-from-bank perspective).
            # Actually for credit cards, a purchase IS money you owe, treated as spending (negative).
            # A payment to the card is a transfer (handled on the bank side, ignore here).
            section = t.get("section")
            amt = t["amount"]
            if section == "purchase":
                signed = -abs(amt)
            elif section == "credit":
                # could be a payment (transfer) or a refund (income)
                # if it's a refund we want it as +; if it's a CC payment we mark transfer
                signed = +abs(amt)
            elif section in ("interest", "fee"):
                signed = -abs(amt)
            else:
                signed = amt

            cat, is_transfer = categorize(t["description"])
            out.append({
                "date": t["date"],
                "post_date": t.get("post_date"),
                "source": "boa_credit",
                "description": t["description"],
                "amount": signed,
                "category": cat,
                "is_transfer": is_transfer,
                "raw": t,
            })
    return out


def normalize_splitwise(sw: dict) -> list[dict]:
    out = []
    user_id = (sw.get("current_user") or {}).get("id")
    for exp in sw.get("expenses", []):
        if exp.get("deleted_at"):
            continue
        # find this user's share
        my_share = 0.0
        my_paid = 0.0
        for u in exp.get("users", []):
            if u.get("user_id") == user_id or (u.get("user") or {}).get("id") == user_id:
                my_share = float(u.get("owed_share") or 0)
                my_paid = float(u.get("paid_share") or 0)
        # net effect on you: if you paid more than your share, others owe you (positive net out then settled)
        # For "what did I spend" we use my_share (your portion of the bill)
        net = -my_share  # negative = your real cost
        date = (exp.get("date") or "")[:10]
        desc = exp.get("description") or ""
        cat, is_transfer = categorize(desc)
        # Fall back to Splitwise's own category if our rules didn't match
        if cat == "uncategorized":
            sw_cat = (exp.get("category") or {}).get("name")
            if sw_cat:
                cat = f"splitwise:{sw_cat.lower().replace(' ', '_')}"
        # Splitwise "Payment" type means a settle-up, mark as transfer
        if exp.get("payment"):
            is_transfer = True
            cat = "transfer:splitwise_settle"
            net = -my_paid + my_share  # how money actually moved for you
        out.append({
            "date": date,
            "source": "splitwise",
            "description": desc,
            "amount": net,
            "paid_by_you": my_paid,
            "your_share": my_share,
            "category": cat,
            "is_transfer": is_transfer,
            "raw": {
                "id": exp.get("id"),
                "cost": exp.get("cost"),
                "currency": exp.get("currency_code"),
                "group_id": exp.get("group_id"),
                "creation_method": exp.get("creation_method"),
                "category": (exp.get("category") or {}).get("name"),
            },
        })
    return out


def main():
    chase_path = DATA / "chase.json"
    boa_path = DATA / "boa.json"
    sw_path = DATA / "splitwise.json"

    transactions = []
    counts = {}

    if chase_path.exists():
        chase = json.loads(chase_path.read_text(encoding="utf-8"))
        rows = normalize_chase(chase)
        transactions.extend(rows)
        counts["chase_checking"] = len(rows)

    if boa_path.exists():
        boa = json.loads(boa_path.read_text(encoding="utf-8"))
        rows = normalize_boa(boa)
        transactions.extend(rows)
        counts["boa_credit"] = len(rows)

    if sw_path.exists():
        sw = json.loads(sw_path.read_text(encoding="utf-8"))
        rows = normalize_splitwise(sw)
        transactions.extend(rows)
        counts["splitwise"] = len(rows)

    transactions.sort(key=lambda t: (t["date"], t["source"]))

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": counts,
        "total_transactions": len(transactions),
        "transactions": transactions,
    }

    out_path = DATA / "unified.json"
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {out_path}")
    print(f"  sources: {counts}")
    print(f"  total: {len(transactions)} transactions")


if __name__ == "__main__":
    main()
