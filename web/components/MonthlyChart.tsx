import { fmtUSD } from "@/lib/format";

interface Props {
  monthly: { month: string; in: number; out: number }[];
}

// CSS 3D perspective bars — no WebGL, no animation loop, fully static SSR.
// Looks dimensional but ships zero JS.
export default function MonthlyChart({ monthly }: Props) {
  const data = monthly.slice(-6);
  const max = Math.max(1, ...data.flatMap((m) => [m.in, m.out]));
  const maxBarH = 180; // px

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-bold">Your money over the last 6 months</h2>
        <p className="text-sm text-[color:var(--color-text-soft)] mt-0.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-[color:var(--color-up)] mr-1.5 align-middle" /> what came in
          <span className="inline-block h-2 w-2 rounded-sm bg-[color:var(--color-down)] ml-3 mr-1.5 align-middle" /> what went out
        </p>
      </div>
      <div
        className="rounded-2xl border border-[color:var(--color-border)] bg-gradient-to-b from-white to-stone-50 px-6 pt-8 pb-4"
        style={{ perspective: "900px" }}
      >
        <div
          className="flex items-end justify-around gap-3 mb-2"
          style={{ transform: "rotateX(8deg)", transformStyle: "preserve-3d", height: maxBarH + 30 }}
        >
          {data.map((m) => {
            const inH = Math.max(6, (m.in / max) * maxBarH);
            const outH = Math.max(6, (m.out / max) * maxBarH);
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center">
                <div className="flex items-end gap-1.5 mb-1">
                  <Bar height={inH} color="up" value={m.in} />
                  <Bar height={outH} color="down" value={m.out} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((m) => {
            const d = new Date(m.month + "-01");
            const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
            return (
              <div key={m.month} className="text-center">
                <div className="text-[12px] font-semibold text-[color:var(--color-text)]">{monthLabel}</div>
                <div className="text-[10px] text-[color:var(--color-up)] font-mono-tab">+{fmtUSD(m.in, { decimals: 0 })}</div>
                <div className="text-[10px] text-[color:var(--color-down)] font-mono-tab">−{fmtUSD(m.out, { decimals: 0 })}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Bar({ height, color, value }: { height: number; color: "up" | "down"; value: number }) {
  const palette =
    color === "up"
      ? { face: "#16a34a", side: "#15803d", top: "#22c55e" }
      : { face: "#dc2626", side: "#b91c1c", top: "#ef4444" };
  const W = 28;
  const D = 14; // depth
  return (
    <div className="relative" style={{ width: W, height }}>
      {/* top */}
      <div
        className="absolute"
        style={{
          width: W,
          height: D,
          background: palette.top,
          top: -D / 2,
          left: D / 2,
          transform: "skewX(-45deg)",
          transformOrigin: "bottom left",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)",
        }}
      />
      {/* side */}
      <div
        className="absolute"
        style={{
          width: D,
          height: height,
          background: palette.side,
          right: -D,
          top: D / 2,
          transform: "skewY(-45deg)",
          transformOrigin: "top left",
        }}
      />
      {/* face */}
      <div
        className="absolute inset-0 rounded-t-[2px]"
        style={{
          background: `linear-gradient(to bottom, ${palette.face}, ${palette.side})`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.1)",
        }}
        title={`${color === "up" ? "+" : "−"}$${Math.round(value).toLocaleString()}`}
      />
    </div>
  );
}
