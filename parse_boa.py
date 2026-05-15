"""Parse Bank of America credit card PDF statements.

BoA layout for transaction rows:
  TXN_DATE POST_DATE DESCRIPTION REF_NUMBER ACCT_NUMBER AMOUNT

Sections we care about:
  - "Payments and Other Credits" (negative amounts = credits to balance)
  - "Purchases and Adjustments" (positive amounts = charges)
  - "Interest Charged"
  - "Fees Charged"
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
PERIOD_RE = re.compile(
    r"([A-Z][a-z]+ \d{1,2})\s*-\s*([A-Z][a-z]+ \d{1,2}),\s*(\d{4})"
)
SECTIONS = {
    "Payments and Other Credits": "credit",
    "Purchases and Adjustments": "purchase",
    "Interest Charged": "interest",
    "Fees Charged": "fee",
}


def parse_amount(s: str) -> float:
    return float(s.replace(",", ""))


def detect_period(pdf) -> tuple[str, str]:
    text = pdf.pages[0].extract_text() or ""
    m = PERIOD_RE.search(text)
    if not m:
        return ("", "")
    year = int(m.group(3))
    start = datetime.strptime(f"{m.group(1)} {year}", "%B %d %Y").date()
    end = datetime.strptime(f"{m.group(2)} {year}", "%B %d %Y").date()
    # Handle year-rollover (Dec - Jan)
    if end < start:
        end = end.replace(year=year + 1)
    return (start.isoformat(), end.isoformat())


def parse_transactions(pdf_path: Path) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        period_start, period_end = detect_period(pdf)
        start_year = int(period_start[:4]) if period_start else datetime.now().year
        end_year = int(period_end[:4]) if period_end else start_year
        start_month = int(period_start[5:7]) if period_start else 1

        txns = []
        current_section = None

        for page in pdf.pages:
            text = page.extract_text() or ""
            for raw_line in text.split("\n"):
                line = raw_line.strip()
                if not line:
                    continue

                # Section detector
                for header, kind in SECTIONS.items():
                    if line.startswith(header):
                        current_section = kind
                        break
                else:
                    if line.startswith("TOTAL "):
                        current_section = None
                        continue

                if not current_section:
                    continue

                tokens = line.split()
                if len(tokens) < 4:
                    continue
                if not (DATE_RE.match(tokens[0]) and DATE_RE.match(tokens[1])):
                    continue

                # Last token must be an amount
                if not AMOUNT_RE.match(tokens[-1]):
                    continue
                amount = parse_amount(tokens[-1])

                # tokens[-2] is account number suffix (4 digits), tokens[-3] is ref number
                acct_num = tokens[-2] if tokens[-2].isdigit() else None
                ref_num = tokens[-3] if len(tokens) >= 5 and tokens[-3].isdigit() else None

                # Description is everything between [2] and the trailing ref/acct/amount
                tail_count = 1  # amount
                if acct_num:
                    tail_count += 1
                if ref_num:
                    tail_count += 1
                desc_tokens = tokens[2:len(tokens) - tail_count]
                description = " ".join(desc_tokens)

                mm, dd = tokens[0].split("/")
                month = int(mm)
                year = start_year if month >= start_month else end_year
                txn_date = f"{year:04d}-{month:02d}-{int(dd):02d}"

                pmm, pdd = tokens[1].split("/")
                pmonth = int(pmm)
                pyear = start_year if pmonth >= start_month else end_year
                post_date = f"{pyear:04d}-{pmonth:02d}-{int(pdd):02d}"

                txns.append({
                    "date": txn_date,
                    "post_date": post_date,
                    "description": description,
                    "amount": amount,
                    "section": current_section,
                    "ref_number": ref_num,
                    "source": "boa_credit",
                })

    return {
        "source": "boa_credit",
        "file": pdf_path.name,
        "period_start": period_start,
        "period_end": period_end,
        "transactions": txns,
    }


def main():
    pdf_dir = Path(__file__).parent.parent / "boa"
    out_path = Path(__file__).parent / "data" / "boa.json"
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
