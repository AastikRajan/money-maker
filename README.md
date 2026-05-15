# money-maker

Personal finance aggregator. Pulls Chase checking PDF statements, Bank of America credit card PDF statements, and Splitwise data, and merges everything into one categorized timeline with a visual HTML dashboard.

Built because bank apps don't let you see all your money in one place — and don't catch when you forget to log a Zelle on Splitwise.

## What it does

- **Parses bank PDFs.** Drop your Chase + BoA monthly statement PDFs into folders; extract transactions to JSON.
- **Pulls Splitwise.** All expenses, friends, and groups via the Splitwise API.
- **Reconciles.** Matches each Chase Zelle-out to its Splitwise settle-up. Matches BoA credit-card payments to the Chase debits that paid them. So you don't double-count.
- **Flags anomalies.** Surfaces Zelle payments to friends that have no matching Splitwise entry (likely "I forgot to log this") and recurring same-amount charges that aren't tagged as subscriptions.
- **Visualizes.** Self-contained HTML dashboard — open it in a browser, no server needed. Filterable transaction table, monthly cash flow, category breakdown, top merchants, subscription audit.

## Setup

```bash
pip install -r requirements.txt
```

Create a `.env` with your Splitwise API key (get one at https://secure.splitwise.com/apps after registering an app — use the personal API key, not OAuth):

```
SPLITWISE_CONSUMER_KEY=...
SPLITWISE_CONSUMER_SECRET=...
SPLITWISE_API_KEY=...
```

Place statement PDFs:

```
../chase/*.pdf      Chase College Checking statements (downloaded from chase.com)
../boa/*.pdf        BoA credit card eStatements (downloaded from bankofamerica.com)
```

(The repo expects these folders to live one level above `money_maker/`. Adjust `parse_chase.py` / `parse_boa.py` if you want them elsewhere.)

## Usage

Run in this order — each step writes to `data/`:

```bash
python parse_chase.py        # PDFs → data/chase.json
python parse_boa.py          # PDFs → data/boa.json
python pull_splitwise.py     # API  → data/splitwise.json
python build_dataset.py      # combines + categorizes → data/unified.json
python reconcile.py          # links cross-source events, flags anomalies → data/anomalies.json
python dashboard.py          # → dashboard.html (open in browser)
```

Or quick CLI summary instead of opening the dashboard:

```bash
python summary.py                    # last 30 days
python summary.py --month 2026-05    # specific month
python summary.py --category food    # filter by category
python summary.py --search costco    # search descriptions
```

## Data schema

Each transaction in `data/unified.json` is normalized to:

```jsonc
{
  "date": "2026-04-29",
  "source": "chase_checking",      // chase_checking | boa_credit | splitwise
  "description": "Fedwire Credit Via: Citibank ...",
  "amount": 2500.00,                // negative = money out, positive = money in
  "category": "income:wire",        // rule-based; falls back to Splitwise's category
  "is_transfer": false,             // true = moving money, not real spending
  "link_id": "ccpay-r1ba0bmu0",     // present if reconciled across sources
  "flags": ["cc_payment_matched"],  // reconciliation / anomaly tags
  "raw": { /* source-specific fields preserved */ }
}
```

## Categories

Rule-based, regex-driven (see `CATEGORY_RULES` in `build_dataset.py`). Splitwise's own category is used as fallback. Categories are namespaced:

- `income:` wire, zelle_in, refund, rewards
- `transfer:` cc_payment, zelle_out, splitwise_settle (excluded from "real spending" by default)
- `subscription:` ai, apple, movies, uber_one, other
- `groceries`, `food:dining`, `food:delivery`
- `transport:rideshare`, `transport:other`
- `shopping:amazon`
- `personal:vape`
- `entertainment:movies`
- `splitwise:<name>` for Splitwise-only categories
- `uncategorized` — adjust the rules dict to fix

## Privacy

`.env` and `data/` are gitignored. **Never commit your statements or your API keys.** This repo only contains parsing/dashboard code; the data lives only on your machine.

## Limitations

- Chase parser tested on Chase College Checking statements (other Chase product layouts may differ slightly).
- BoA parser tested on BoA credit card statements (not BoA checking).
- Reconciliation is heuristic — uses confirmation codes for CC payments (exact match) and name + amount + date window for Splitwise settles. False matches are possible if you have multiple same-amount Zelles to people with similar first names within a few days.

## License

MIT
