import { useId } from "react";

import { formatINR } from "@/lib/format";
import type { GrowthPoint } from "@/types/dashboard";

const W = 1000;
const H = 200;
/** Horizontal inset so the first/last bars and points are not clipped by the frame. */
const PAD_X = 50;
const BAR_W = 56;

interface ChartPoint {
  x: number;
  y: number;
  barY: number;
  barH: number;
  data: GrowthPoint;
}

/** Ceiling of the registrations axis, divisible by 3 so the three grid bands get whole labels. */
function niceMax(max: number): number {
  const step = Math.max(1, Math.ceil((max * 1.15) / 3));
  return step * 3;
}

/** Smooth cubic curve through the points — same construction as the original svgCurvePath(). */
function curvePath(points: ChartPoint[]): string {
  const first = points[0];
  if (!first) return "";
  let d = `M ${first.x},${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const cx = p0.x + (p1.x - p0.x) / 2;
    d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

/**
 * "Growth Analysis": registrations as the red glowing curve (as before), revenue as soft bars behind it.
 * The SVG stretches to the card width; points and labels are HTML overlays so they never distort.
 */
export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const uid = useId().replace(/:/g, "");
  const maxReg = niceMax(Math.max(0, ...data.map((d) => d.new_members)));
  const maxRev = Math.max(0, ...data.map((d) => d.revenue));
  const n = data.length;

  const points: ChartPoint[] = data.map((d, i) => {
    const x = n > 1 ? PAD_X + (i * (W - 2 * PAD_X)) / (n - 1) : W / 2;
    const barH = maxRev > 0 ? (d.revenue / maxRev) * H * 0.85 : 0;
    return { x, y: H - (d.new_members / maxReg) * H, barY: H - barH, barH, data: d };
  });

  const curve = curvePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const area = curve && first && last ? `${curve} L ${last.x},${H} L ${first.x},${H} Z` : "";
  const yLabels = [maxReg, (maxReg * 2) / 3, maxReg / 3, 0];

  return (
    <div className="relative mt-10 pl-[50px] max-md:mt-[30px] max-md:pl-[35px]">
      {/* Y axis (registrations) */}
      <div className="absolute left-0 top-0 flex h-[220px] w-10 flex-col justify-between max-md:h-[180px]">
        {yLabels.map((v) => (
          <span key={v} className="text-right text-[11px] font-bold text-muted opacity-80">{Math.round(v)}</span>
        ))}
      </div>

      <div className="relative h-[220px] max-md:h-[180px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d63a3a" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#d63a3a" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#d63a3a" stopOpacity="0" />
            </linearGradient>
            <filter id={`glow-${uid}`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {[0, 66, 133, 200].map((y) => (
            <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgb(var(--line))" strokeWidth="1" strokeDasharray="4"
              vectorEffect="non-scaling-stroke" />
          ))}

          {points.map((p) => (
            <rect key={`bar-${p.data.month}`} x={p.x - BAR_W / 2} y={p.barY} width={BAR_W} height={p.barH} rx="6"
              className="fill-line transition-colors hover:fill-line-strong">
              <title>{`${p.data.month}: ${formatINR(p.data.revenue, true)} revenue`}</title>
            </rect>
          ))}

          <path d={area} fill={`url(#area-${uid})`} className="pointer-events-none" />
          <path d={curve} fill="none" stroke="#d63a3a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" filter={`url(#glow-${uid})`} className="pointer-events-none" />
        </svg>

        {/* Data points (HTML so they stay round at any width) */}
        {points.map((p) => (
          <div key={`pt-${p.data.month}`} className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}>
            <div className="h-3 w-3 cursor-pointer rounded-full border-4 border-accent bg-surface transition-all duration-300 group-hover:h-[18px] group-hover:w-[18px] group-hover:shadow-glow" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary-grey px-2.5 py-1.5 text-center opacity-0 shadow-dropdown transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100">
              <div className="text-sm font-extrabold text-white">{p.data.new_members} members</div>
              <div className="text-[11px] font-bold text-white/70">{formatINR(p.data.revenue, true)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* X axis */}
      <div className="relative h-12">
        {points.map((p) => (
          <span key={`x-${p.data.month}`}
            className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.05em] text-muted max-sm:origin-top-left max-sm:-rotate-45"
            style={{ left: `${(p.x / W) * 100}%` }}>
            {p.data.month}
          </span>
        ))}
      </div>
    </div>
  );
}
