import { toRoman } from "@/lib/format";

export default function SectionHead({ num, title, subtitle }: { num: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 mt-16">
      <div className="flex items-baseline gap-5">
        <span className="font-display text-3xl italic font-semibold text-[color:var(--color-gold-deep)]">
          {toRoman(num)}.
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--color-ink)]">
          {title}
        </span>
        <span className="relative ml-2 h-px flex-1 bg-gradient-to-r from-[color:var(--color-gold)] to-[color:color-mix(in_srgb,var(--color-gold)_18%,transparent)]">
          <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-[color:var(--color-gold)]" />
        </span>
      </div>
      {subtitle && (
        <p className="ml-12 mt-2 max-w-2xl font-display text-base italic text-[color:var(--color-ink-soft)]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
