# Money Maker — web

A simple money diary. Tells you, in plain English, what came in and what went out, day by day. Surfaces things that look weird (Zelles missing from Splitwise, untagged recurring charges).

## Run

For everyday use, run the **production build** — it's small and fast (398 KB / ~5ms response):

```bash
cd web
npm install --legacy-peer-deps
npm run build && npm run start    # http://localhost:3000
```

Use `npm run dev` only when editing code (HMR + source maps make the dev payload ~10× larger).

Reads `../data/{unified,anomalies,splitwise}.json` server-side at request time. Run the Python pipeline first.

## What's on the page (top to bottom)

1. **Hi, here's your money** — current Chase balance, last 30 days spent / received / net.
2. **Your money over the last 6 months** — 3D-perspective bar chart (CSS only, no WebGL). Green bars = money in, red = out. Numbers labeled under each month.
3. **Your last big income** — most recent wire, with a balance line showing how it's been drawn down since, plus three plain boxes: spent on stuff / moved to others / left right now.
4. **Things to check** — the anomaly list (Zelles likely missing from Splitwise, untagged recurring charges). Each has a ✓ button to dismiss as handled.
5. **Where your money flowed** — two-column In / Out view of the last 30 days, with bars for each category.
6. **People in your money** — Splitwise friends + Zelle activity, side by side, with "Owes you" / "You owe" / "Settled" badges.
7. **Recurring subscriptions** — what's quietly billing you.
8. **Day by day** — vertical timeline. Each Zelle is **enriched with its Splitwise story** ("↳ For 'Trader Joe's groceries' · Onkar paid $94.50, your share $47.25") so you see why each transfer happened. Filters for window, hide transfers, min amount.
9. **Where it goes** — top 8 categories as horizontal bars.
10. **Search every transaction** — full filterable ledger with text search, account / flow filters, "show 50 more" pagination.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript strict
- Tailwind CSS v4 with `@theme` tokens
- Motion (Framer) for the small fade-in animations and dismissals
- Lucide for icons

No Three.js, no D3, no Sankey. Plain SVG for the one chart.

## Privacy

Data lives in `../data/` (gitignored). The web folder ships only code.
