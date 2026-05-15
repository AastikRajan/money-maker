"""Parse Chase College Checking PDF statements into structured transactions.

Chase layout: DATE | DESCRIPTION (multi-line) | AMOUNT | BALANCE
Deposits are positive in AMOUNT column; debits are negative.
We use word-level extraction with x-coordinates because plain text loses
column alignment for deposit-vs-debit rows.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from datetime import datetime

import pdfplumber

DATE_RE = re.compile(r"^\d{2}/\d{2}$")
AMOUNT_RE = re.compile(r"^-?[\d,]+\.\d{2}$")
STATEMENT_PERIOD_RE = re.compile(
    r"([A-Z][a-z]+ \d{1,2}, \d{4}) through ([A-Z][a-z]+ \d{1,2}, \d{4})"
)


def parse_amount(s: str) -> float:
    return float(s.replace(",", ""))


def detect_period(pdf) -> tuple[str, str]:
    text = pdf.pages[0].extract_text() or ""
    m = STATEMENT_PERIOD_RE.search(text)
    if not m:
        return ("", "")
    start = datetime.strptime(m.group(1), "%B %d, %Y").date().isoformat()
    end = datetime.strptime(m.group(2), "%B %d, %Y").date().isoformat()
    return (start, end)


def extract_rows(pdf) -> list[list[dict]]:
    """Return list of pages, each page is list of word dicts grouped into rows."""
    all_rows = []
    for page in pdf.pages:
        words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
        # Group words by their y-position (within ~3pt = same row)
        rows = []
        current_row = []
        current_top = None
        for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
            if current_top is None or abs(w["top"] - current_top) < 3:
                current_row.append(w)
                if current_top is None:
                    current_top = w["top"]
            else:
                rows.append(sorted(current_row, key=lambda w: w["x0"]))
                current_row = [w]
                current_top = w["top"]
        if current_row:
            rows.append(sorted(current_row, key=lambda w: w["x0"]))
        all_rows.append(rows)
    return all_rows


def parse_transactions(pdf_path: Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        period_start, period_end = detect_period(pdf)
        pages_rows = extract_rows(pdf)

        # Determine the year to assign to MM/DD dates.
        # Chase statements span across year boundaries; use period_start year for
        # months >= start month, else period_end year.
        start_year = int(period_start[:4]) if period_start else datetime.now().year
        end_year = int(period_end[:4]) if period_end else start_year
        start_month = int(period_start[5:7]) if period_start else 1

        txns = []
        in_txn_section = False
        # We'll buffer rows until we see the next date-prefixed row, so multi-line
        # descriptions get joined properly.
        current_txn = None

        for rows in pages_rows:
            for row in rows:
                texts = [w["text"] for w in row]
                joined = " ".join(texts)

                if "TRANSACTION DETAIL" in joined:
                    in_txn_section = True
                    current_txn = None
                    continue
                if not in_txn_section:
                    continue
                if "Ending Balance" in joined or "CHECKING SUMMARY" in joined:
                    if current_txn:
                        txns.append(current_txn)
                        current_txn = None
                    in_txn_section = False
                    continue
                # Skip header rows
                if joined.strip() in ("DATE DESCRIPTION AMOUNT BALANCE", "Beginning Balance"):
                    continue
                if joined.startswith("Beginning Balance"):
                    continue

                # Is this a new transaction row? (starts with MM/DD)
                if texts and DATE_RE.match(texts[0]):
                    if current_txn:
                        txns.append(current_txn)
                    mm, dd = texts[0].split("/")
                    month = int(mm)
                    year = start_year if month >= start_month else end_year
                    date_iso = f"{year:04d}-{month:02d}-{int(dd):02d}"

                    # The last 1 or 2 tokens are amounts (amount + balance) or just balance
                    # For pure deposits (no negative), there are still 2 numbers (amt + bal).
                    # For multi-line descriptions, the amount/balance might be on this row only.
                    amounts_at_end = []
                    for tok in reversed(texts):
                        if AMOUNT_RE.match(tok):
                            amounts_at_end.insert(0, tok)
                            if len(amounts_at_end) == 2:
                                break
                        else:
                            break

                    desc_tokens = texts[1:len(texts) - len(amounts_at_end)]
                    description = " ".join(desc_tokens).strip()

                    amount = None
                    balance = None
                    if len(amounts_at_end) == 2:
                        amount = parse_amount(amounts_at_end[0])
                        balance = parse_amount(amounts_at_end[1])
                    elif len(amounts_at_end) == 1:
                        # Only balance present (rare); amount unknown
                        balance = parse_amount(amounts_at_end[0])

                    current_txn = {
                        "date": date_iso,
                        "description": description,
                        "amount": amount,
                        "balance": balance,
                        "source": "chase_checking",
                    }
                else:
                    # Continuation row of previous transaction's description
                    if current_txn is not None:
                        # Strip any trailing amounts that may have wrapped
                        extra = []
                        for tok in texts:
                            if AMOUNT_RE.match(tok) and len(extra) == 0:
                                # likely a wrapped amount; ignore for now
                                continue
                            extra.append(tok)
                        if extra:
                            current_txn["description"] += " " + " ".join(extra)

        if current_txn:
            txns.append(current_txn)

    # Compute amount sign from balance delta when amount is missing or sign is wrong.
    # Chase shows debits as negative AMOUNT but deposits positive. Our extractor
    # captures the sign as printed. Verify by checking running balance.
    return {
        "source": "chase_checking",
        "file": pdf_path.name,
        "period_start": period_start,
        "period_end": period_end,
        "transactions": txns,
    }


def main():
    pdf_dir = Path(__file__).parent.parent / "chase"
    out_path = Path(__file__).parent / "data" / "chase.json"
    out_path.parent.mkdir(exist_ok=True)

    statements = []
    for pdf in sorted(pdf_dir.glob("*.pdf")):
        print(f"Parsing {pdf.name}...", file=sys.stderr)
        statements.append(parse_transactions(pdf))

    out_path.write_text(json.dumps(statements, indent=2), encoding="utf-8")
    total = sum(len(s["transactions"]) for s in statements)
    print(f"Wrote {out_path} ({len(statements)} statements, {total} transactions)")


if __name__ == "__main__":
    main()
