# Wealth Ledger — web app

The "Wealth Ledger" is the visual front-end for `money-maker`. Next.js 15 + React 19 + Three.js + D3-Sankey + Framer Motion.

## What it shows

A single scrollable narrative built around your data:

1. **Hero & Vault** — animated 3D bar chart of six months of cash flow, with floating gold coins (Three.js).
2. **Items Requiring Attention** — Splitwise omissions surfaced in claret cards.
3. **Money Trace** — interactive Sankey diagram. Pick a window (defaults to "since your last big wire"). Particles flow along the ribbons in real time. Claret ribbons mark flows that include items missing from Splitwise. Click any node to see the underlying transactions.
4. **People** — your Splitwise friends ranked by absolute net balance, with Zelle traffic alongside.
5. **Standing Orders** — active subscriptions with last-seen dates.
6. **Ledger** — full filterable transaction table.

## Run

```bash
cd web
npm install --legacy-peer-deps   # React 19 peer-dep transition still in progress
npm run dev                       # http://localhost:3000
# OR
npm run build && npm start
```

The app reads `../data/unified.json`, `../data/anomalies.json`, and `../data/splitwise.json` server-side at request time. Make sure you've run the Python pipeline first (see project root README).

## Stack

- **Next.js 15** — App Router, server components, Turbopack
- **React 19**
- **TypeScript** strict mode
- **Tailwind CSS v4** — CSS-based theme tokens, `@theme` block, `color-mix()`
- **Three.js** — raw WebGL for the Vault hero
- **D3-Sankey** — Money Trace layout
- **Motion (Framer)** — reveal animations and transitions
- **Lucide** — iconography

## Theme

"Old money" — Cormorant Garamond italic for display, Manrope for UI, JetBrains Mono for tabular figures. British racing green for receipts, oxblood claret for expenditures, aged brass gold for accents. Parchment cream background with subtle SVG-noise grain texture.

## Privacy

The web app reads JSON from `../data/`. That folder, plus `.env` and any built artifacts, are gitignored. Nothing personal goes to the repo.
