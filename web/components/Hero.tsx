"use client";
import { motion } from "motion/react";
import { fmtUSD, toRoman } from "@/lib/format";

interface HeroProps {
  generatedAt: string;
  totalInflow: number;
  totalOutflow: number;
  net: number;
  anomalyCount: number;
  monthLabel: string;
}

export default function Hero({ generatedAt, totalInflow, totalOutflow, net, anomalyCount, monthLabel }: HeroProps) {
  return (
    <section className="relative pt-12 pb-10">
      <div className="mb-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full border border-[color:var(--color-gold)] bg-[color:var(--color-parch-light)] font-display text-2xl text-[color:var(--color-gold-deep)] shadow-[0_8px_30px_-10px_rgba(167,130,64,0.4)]"
        >
          &#9670;
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-5xl font-medium leading-none md:text-7xl"
        >
          A statement <em className="gold-shimmer font-semibold">of wealth</em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-[color:var(--color-ink-mute)]"
        >
          {monthLabel} &middot; Anno Domini {toRoman(new Date().getFullYear())}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-3 font-display text-base italic text-[color:var(--color-ink-soft)]"
        >
          Every coin accounted for, every shilling explained.
        </motion.p>
      </div>

      <div className="fancy-rule mx-auto mb-12">
        <span className="text-[10px] tracking-[0.8em] text-[color:var(--color-gold)]">
          &#x25C6; &#x25C6; &#x25C6;
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[color:color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-gold)_15%,transparent)] shadow-[0_8px_30px_-12px_rgba(28,24,20,0.18)] md:grid-cols-4">
        <BigStat label="Received" value={fmtUSD(totalInflow)} tone="emerald" delay={0.1} />
        <BigStat label="Expended" value={fmtUSD(-totalOutflow)} tone="claret" delay={0.15} />
        <BigStat label="Net Position" value={fmtUSD(net)} tone={net >= 0 ? "emerald" : "claret"} delay={0.2} />
        <BigStat
          label="To Review"
          value={anomalyCount > 0 ? toRoman(anomalyCount) : "0"}
          tone="gold"
          subtle="items"
          delay={0.25}
        />
      </div>

      <div className="mt-3 text-center text-[10px] uppercase tracking-[0.3em] text-[color:var(--color-ink-mute)]">
        Compiled {generatedAt.replace("T", " ").slice(0, 16)} UTC
      </div>
    </section>
  );
}

function BigStat({ label, value, tone, subtle, delay }: { label: string; value: string; tone: "emerald" | "claret" | "gold"; subtle?: string; delay: number }) {
  const toneClass = {
    emerald: "text-[color:var(--color-emerald-royal)]",
    claret: "text-[color:var(--color-claret)]",
    gold: "text-[color:var(--color-gold-deep)]",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="bg-[color:var(--color-parch-light)] px-7 py-7 transition-colors hover:bg-[color:var(--color-parch-warm)]"
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--color-gold-deep)]">
        <span className="block h-px w-4 bg-[color:var(--color-gold)]" />
        {label}
      </div>
      <div className={`font-mono-tab text-3xl font-medium tracking-tight ${toneClass}`}>{value}</div>
      {subtle && <div className="mt-2 font-display text-sm italic text-[color:var(--color-ink-mute)]">{subtle}</div>}
    </motion.div>
  );
}
