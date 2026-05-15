# Money Maker — web

A simple money diary. Tells you, in plain English, what came in and what went out, day by day. Surfaces things that look weird (Zelles missing from Splitwise, untagged recurring charges).

## Run

```bash
cd web
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
```

Reads `../data/{unified,anomalies}.json` server-side at request time. Run the Python pipeline first.

## What's on the page (top to bottom)

1. **Hi, here's your money.** — current Chase balance, last 30 days spent / received / net.
2. **Your last big income** — most recent wire / large deposit, with a small balance line showing how it's been drawn down since, and three plain-English boxes: spent on stuff / moved to others / left right now.
3. **Things to check** — the anomaly list. Each has a ✓ button you can tap to mark it handled.
4. **Day by day** — vertical timeline of days. Newest first. Each day card shows total in/out and lists transactions. Filters: window (week/30/60/90), hide transfers, min amount.
5. **Where it goes** — top categories of the last 30 days as a simple bar chart.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4 with `@theme` tokens
- Motion (Framer) for the small fade-in animations and dismissals
- Lucide for icons

No Three.js, no D3, no Sankey. Plain SVG for the one chart.

## Privacy

Data lives in `../data/` (gitignored). The web folder ships only code.
