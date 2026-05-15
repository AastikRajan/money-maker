"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, SankeyGraph } from "d3-sankey";
import { motion, AnimatePresence } from "motion/react";
import { fmtUSD, shortDate } from "@/lib/format";
import type { Transaction, Anomaly } from "@/lib/types";
import { buildMoneyTrace, type SankeyNode, type SankeyLink } from "@/lib/trace";

interface MoneyTraceProps {
  transactions: Transaction[];
  anomalies: Anomaly[];
  defaultFrom: string;
  defaultTo: string;
  pivotDate?: string;
  pivotLabel?: string;
}

interface RenderNode extends SankeyNode {
  x0: number; y0: number; x1: number; y1: number;
  index?: number;
}
interface RenderLink {
  source: RenderNode;
  target: RenderNode;
  value: number;
  width: number;
  y0: number; y1: number;
  meta?: SankeyLink["meta"];
}

const KIND_COLOR: Record<string, string> = {
  inflow:    "#1a3d2e",
  channel:   "#a78240",
  category:  "#7a5d2a",
  merchant:  "#4f463a",
  person:    "#6e1f2a",
  subscription: "#2e5a47",
};

export default function MoneyTrace({ transactions, anomalies, defaultFrom, defaultTo, pivotDate, pivotLabel }: MoneyTraceProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [hover, setHover] = useState<{ node?: SankeyNode; link?: { source: SankeyNode; target: SankeyNode; value: number; flagged?: boolean } } | null>(null);
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(
    () => buildMoneyTrace(transactions, { from, to, anomalies }),
    [transactions, anomalies, from, to]
  );

  const dimensions = { width: 1200, height: Math.max(420, data.nodes.length * 14) };

  const layout = useMemo(() => {
    if (data.nodes.length === 0) return null;
    const generator = sankey<SankeyNode, SankeyLink>()
      .nodeId((d) => d.id)
      .nodeWidth(14)
      .nodePadding(10)
      .nodeAlign((node, n) => {
        const k = (node as SankeyNode).kind;
        if (k === "inflow") return 0;
        if (k === "channel") return 1;
        if (k === "category") return 2;
        return 3;
      })
      .extent([[0, 20], [dimensions.width, dimensions.height - 20]]);

    const graph: SankeyGraph<SankeyNode, SankeyLink> = generator({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });
    return graph;
  }, [data, dimensions.height, dimensions.width]);

  // Animated particles
  useEffect(() => {
    if (!svgRef.current || !layout) return;
    const svg = svgRef.current;
    const linkEls = svg.querySelectorAll<SVGPathElement>(".sankey-link");

    interface Particle { el: SVGCircleElement; path: SVGPathElement; t: number; speed: number; }
    const particles: Particle[] = [];
    const overlay = svg.querySelector<SVGGElement>("#particle-overlay")!;

    const spawn = () => {
      linkEls.forEach((path) => {
        const flagged = path.dataset.flagged === "true";
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("r", flagged ? "2.5" : "1.8");
        c.setAttribute("fill", flagged ? "#6e1f2a" : "#c4a062");
        c.setAttribute("opacity", "0.9");
        if (flagged) c.setAttribute("filter", "url(#glow-claret)");
        else c.setAttribute("filter", "url(#glow-gold)");
        overlay.appendChild(c);
        particles.push({ el: c, path, t: Math.random() * 0.4, speed: 0.0015 + Math.random() * 0.0025 });
      });
    };

    const interval = setInterval(spawn, 1100);
    spawn();

    let raf = 0;
    const tick = () => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.t += p.speed;
        if (p.t >= 1) {
          p.el.remove();
          particles.splice(i, 1);
          continue;
        }
        const len = p.path.getTotalLength();
        const pt = p.path.getPointAtLength(p.t * len);
        p.el.setAttribute("cx", String(pt.x));
        p.el.setAttribute("cy", String(pt.y));
        p.el.setAttribute("opacity", String(p.t < 0.1 ? p.t * 10 : p.t > 0.9 ? (1 - p.t) * 10 : 0.9));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      particles.forEach((p) => p.el.remove());
    };
  }, [layout]);

  // Pre-set buttons
  const presets = [
    { label: "This month", from: defaultTo.slice(0, 8) + "01", to: defaultTo },
    { label: "Last 30 days", from: subDays(defaultTo, 30), to: defaultTo },
    { label: "Last 60 days", from: subDays(defaultTo, 60), to: defaultTo },
    pivotDate ? { label: pivotLabel || `Since ${shortDate(pivotDate)}`, from: pivotDate, to: defaultTo } : null,
    { label: "Year to date", from: defaultTo.slice(0, 4) + "-01-01", to: defaultTo },
  ].filter(Boolean) as { label: string; from: string; to: string }[];

  // Selected node detail
  const selectedTxns = useMemo(() => {
    if (!selectedNode) return [];
    return findTransactionsForNode(transactions, selectedNode, { from, to });
  }, [selectedNode, transactions, from, to]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-warm)] p-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-gold-deep)]">Window</span>
        {presets.map((p) => {
          const active = p.from === from && p.to === to;
          return (
            <button
              key={p.label}
              onClick={() => { setFrom(p.from); setTo(p.to); }}
              className={`rounded-sm border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                active
                  ? "border-[color:var(--color-gold)] bg-[color:var(--color-gold)] text-[color:var(--color-parch)]"
                  : "border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:var(--color-parch-light)] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-parch)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:var(--color-parch-light)] px-2 py-1 text-xs font-mono-tab" />
          <span className="font-display italic text-[color:var(--color-ink-mute)]">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:var(--color-parch-light)] px-2 py-1 text-xs font-mono-tab" />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_25%,transparent)] bg-[color:var(--color-parch-light)] shadow-[0_8px_30px_-15px_rgba(28,24,20,0.18)]">
        {layout ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            className="block w-full"
            style={{ maxHeight: "600px" }}
          >
            <defs>
              <filter id="glow-gold" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-claret" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="ribbon-default" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c4a062" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#a78240" stopOpacity="0.30" />
              </linearGradient>
              <linearGradient id="ribbon-flagged" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#9a4651" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#6e1f2a" stopOpacity="0.40" />
              </linearGradient>
              <linearGradient id="ribbon-emerald" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2e5a47" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#1a3d2e" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Links */}
            <g className="links">
              {(layout.links as unknown as RenderLink[]).map((link, i) => {
                const flagged = link.meta?.flagged;
                const sourceKind = link.source.kind;
                const grad = flagged ? "url(#ribbon-flagged)" : sourceKind === "inflow" ? "url(#ribbon-emerald)" : "url(#ribbon-default)";
                const path = sankeyLinkHorizontal()(link as never) || "";
                return (
                  <path
                    key={i}
                    d={path}
                    fill="none"
                    stroke={grad}
                    strokeWidth={Math.max(1, link.width)}
                    className="sankey-link cursor-pointer transition-opacity"
                    data-flagged={flagged ? "true" : "false"}
                    onMouseEnter={() => setHover({ link: { source: link.source, target: link.target, value: link.value, flagged } })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>{`${link.source.label} → ${link.target.label}: ${fmtUSD(link.value)}${flagged ? " (flagged)" : ""}`}</title>
                  </path>
                );
              })}
            </g>

            <g id="particle-overlay" />

            {/* Nodes */}
            <g className="nodes">
              {(layout.nodes as unknown as RenderNode[]).map((node, i) => {
                const w = node.x1 - node.x0;
                const h = node.y1 - node.y0;
                const isSelected = selectedNode?.id === node.id;
                const flagged = (node.meta as { flagged?: number })?.flagged && (node.meta as { flagged?: number }).flagged! > 0;
                const labelOnRight = node.x0 < dimensions.width / 2;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x0}, ${node.y0})`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover({ node })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelectedNode(isSelected ? null : node)}
                  >
                    <rect
                      width={w}
                      height={h}
                      fill={KIND_COLOR[node.kind] || "#a78240"}
                      stroke={isSelected ? "#1c1814" : flagged ? "#6e1f2a" : "#7a5d2a"}
                      strokeWidth={isSelected ? 2 : 0.5}
                      rx="1"
                    />
                    <text
                      x={labelOnRight ? w + 6 : -6}
                      y={h / 2}
                      dy="0.35em"
                      textAnchor={labelOnRight ? "start" : "end"}
                      fontFamily="Manrope, sans-serif"
                      fontSize="10.5"
                      fontWeight={isSelected ? 700 : 500}
                      fill="#1c1814"
                    >
                      {node.label}
                      <tspan fill="#847762" fontFamily="JetBrains Mono, monospace" fontSize="9.5" dx="6">
                        {fmtUSD(node.value, { decimals: 0 })}
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="p-12 text-center font-display italic text-[color:var(--color-ink-mute)]">
            No transactions in this window.
          </div>
        )}

        {hover && (
          <div className="pointer-events-none absolute right-4 top-4 max-w-xs rounded-sm border border-[color:var(--color-gold)] bg-[color:var(--color-parch-light)] p-3 shadow-lg">
            {hover.node && (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-gold-deep)]">
                  {hover.node.kind}
                </div>
                <div className="mt-1 font-display text-base italic text-[color:var(--color-ink)]">{hover.node.label}</div>
                <div className="mt-1 font-mono-tab text-lg text-[color:var(--color-ink)]">{fmtUSD(hover.node.value)}</div>
                {(hover.node.meta as { count?: number; flagged?: number })?.count != null && (
                  <div className="mt-1 text-[11px] text-[color:var(--color-ink-mute)]">
                    {(hover.node.meta as { count?: number; flagged?: number }).count} entries
                    {(hover.node.meta as { count?: number; flagged?: number }).flagged! > 0 && (
                      <span className="ml-2 text-[color:var(--color-claret)]">
                        &middot; {fmtUSD((hover.node.meta as { count?: number; flagged?: number }).flagged!)} flagged
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 text-[10px] italic text-[color:var(--color-ink-mute)]">Click to inspect transactions</div>
              </>
            )}
            {hover.link && (
              <>
                <div className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-gold-deep)]">flow</div>
                <div className="mt-1 font-display text-sm italic text-[color:var(--color-ink-soft)]">
                  {hover.link.source.label} <span className="text-[color:var(--color-gold)]">→</span> {hover.link.target.label}
                </div>
                <div className="mt-1 font-mono-tab text-lg text-[color:var(--color-ink)]">{fmtUSD(hover.link.value)}</div>
                {hover.link.flagged && (
                  <div className="mt-1 text-[11px] text-[color:var(--color-claret)]">Includes items missing from Splitwise</div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:var(--color-parch-light)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-gold-deep)]">
                    Transactions feeding this node
                  </div>
                  <div className="font-display text-2xl italic text-[color:var(--color-ink)]">{selectedNode.label}</div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-ink-mute)] hover:text-[color:var(--color-ink)]"
                >
                  Close ✕
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {selectedTxns.slice(0, 50).map((t, i) => (
                      <tr key={i} className="border-b border-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)]">
                        <td className="py-1.5 pr-3 font-mono-tab text-xs text-[color:var(--color-ink-mute)]">{t.date}</td>
                        <td className="py-1.5 pr-3 text-[color:var(--color-ink-soft)]">{t.description.slice(0, 80)}</td>
                        <td className={`py-1.5 text-right font-mono-tab font-medium ${
                          t.amount === null ? "" : t.amount < 0 ? "text-[color:var(--color-claret)]" : "text-[color:var(--color-emerald-royal)]"
                        }`}>{t.amount !== null ? fmtUSD(t.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedTxns.length > 50 && (
                  <div className="mt-2 text-center text-xs italic text-[color:var(--color-ink-mute)]">
                    Showing first 50 of {selectedTxns.length}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function subDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function findTransactionsForNode(txns: Transaction[], node: SankeyNode, range: { from: string; to: string }): Transaction[] {
  const inRange = txns.filter((t) => t.date >= range.from && t.date <= range.to);
  if (node.kind === "inflow") {
    return inRange.filter((t) => t.amount !== null && t.amount > 0 && !t.is_transfer && nodeMatchesInflow(node.id, t));
  }
  if (node.kind === "category") {
    return inRange.filter((t) => t.amount !== null && t.amount < 0 && categoryLabel(t.category) === node.label);
  }
  if (node.kind === "merchant" || node.kind === "person") {
    const m = node.id.split(":");
    const catName = m[1];
    const merchant = m[2];
    return inRange.filter((t) => t.amount !== null && t.amount < 0 && categoryLabel(t.category) === catName && merchantMatches(t.description, merchant));
  }
  return inRange;
}

function nodeMatchesInflow(nodeId: string, t: Transaction): boolean {
  const map: Record<string, string> = {
    "in:Wires from family": "income:wire",
    "in:Zelle received": "income:zelle_in",
    "in:Refunds": "income:refund",
    "in:Rewards & cashback": "income:rewards",
  };
  return map[nodeId] === t.category;
}

function categoryLabel(cat: string): string {
  // Mirror the humanizeCategory mapping in trace.ts (kept simple here)
  const map: Record<string, string> = {
    "transfer:zelle_out": "Zelle to people",
    "transfer:cc_payment": "Credit card payment",
    "transfer:splitwise_settle": "Splitwise settle-up",
    "groceries": "Groceries",
    "food:dining": "Restaurants & dining",
    "food:delivery": "Food delivery",
    "subscription:ai": "AI subscriptions",
    "subscription:apple": "Apple subscriptions",
    "subscription:movies": "Movie subscriptions",
    "subscription:uber_one": "Uber One",
    "subscription:other": "Other subscriptions",
    "transport:rideshare": "Rideshare",
    "transport:other": "Other transport",
    "shopping:amazon": "Amazon",
    "personal:vape": "Vape & tobacco",
    "entertainment:movies": "Movie tickets",
    "business:office": "Office supplies",
    "fee:bank": "Bank fees",
  };
  return map[cat] || cat.replace(/[:_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function merchantMatches(desc: string, key: string): boolean {
  if (key === "rest") return true;
  const dk = desc.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
  return dk.startsWith(key.toLowerCase());
}
