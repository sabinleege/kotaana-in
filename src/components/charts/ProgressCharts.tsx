"use client";
import { useEffect, useRef, useState } from "react";

export type Point = { date: string; value: number | null };
type Props = { title: string; subtitle?: string; points: Point[]; unit: string; kind: "line" | "bar"; target?: number | null; yMin?: number; yMax?: number; empty: string; digits?: number; connectGaps?: boolean };

const H = 190, M = { top: 14, right: 12, bottom: 24, left: 40 };
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
function niceMax(v: number) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => n <= s) ?? 10) * p; }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null); const [w, setW] = useState(0);
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  return [ref, w] as const;
}

/** Single-series progress chart (no legend: the title names the series). Hover/keyboard tooltip + table view. */
export function ProgressChart({ title, subtitle, points, unit, kind, target, yMin = 0, yMax, empty, digits = 0, connectGaps = false }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  const hasData = kind === "bar" ? values.some((v) => v > 0) : values.length > 0;
  const fmt = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: digits })}${unit.startsWith("/") ? "" : " "}${unit}`;

  const plotW = Math.max(0, width - M.left - M.right), plotH = H - M.top - M.bottom;
  const lo = kind === "line" && yMax == null ? Math.floor(Math.min(...values, target ?? Infinity) - 1) : yMin;
  const hi = yMax ?? niceMax(Math.max(...values, target ?? 0) * 1.05);
  const span = Math.max(hi - lo, 1e-6);
  const band = points.length ? plotW / points.length : 0;
  const x = (i: number) => M.left + band * i + band / 2;
  const y = (v: number) => M.top + plotH - ((v - lo) / span) * plotH;
  const ticks = [lo, lo + span / 2, hi];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left - M.left) / band); setActive(i >= 0 && i < points.length ? i : null); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1)); if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1)); if (e.key === "Escape") setActive(null); };

  let linePath = "", areaPath = "";
  if (kind === "line") {
    let seg: string[] = []; const segs: string[][] = [];
    points.forEach((p, i) => { if (p.value == null) { if (!connectGaps && seg.length) { segs.push(seg); seg = []; } } else seg.push(`${x(i)},${y(p.value)}`); });
    if (seg.length) segs.push(seg);
    linePath = segs.map((s) => `M${s.join("L")}`).join("");
    areaPath = segs.filter((s) => s.length > 1).map((s) => `M${s[0].split(",")[0]},${M.top + plotH}L${s.join("L")}L${s.at(-1)!.split(",")[0]},${M.top + plotH}Z`).join("");
  }
  const bw = Math.min(24, Math.max(2, band - 2));
  const barPath = (i: number, v: number) => { const x0 = x(i) - bw / 2, y0 = y(v), yb = M.top + plotH, r = Math.min(4, bw / 2, yb - y0); return `M${x0},${yb}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${yb}Z`; };
  const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const act = active != null ? points[active] : null;
  const lastIdx = kind === "line" ? points.map((p) => p.value).lastIndexOf(values.at(-1) ?? NaN) : -1;

  return <div className="chartCard">
    <div className="chartHead"><div><h3>{title}</h3>{subtitle && <p className="small muted">{subtitle}</p>}</div></div>
    {!hasData ? <div className="chartEmpty">{empty}</div> : <div className="chartBox" ref={ref}>
      {width > 0 && <svg width={width} height={H} role="img" aria-label={`${title} chart`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setActive(null)} onKeyDown={onKey} onBlur={() => setActive(null)}>
        {ticks.map((t, i) => <g key={i}><line className="chartRule" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} /><text className="chartTick" x={M.left - 6} y={y(t) + 4} textAnchor="end">{t.toLocaleString(undefined, { maximumFractionDigits: 1 })}</text></g>)}
        {labelIdx.map((i) => <text key={i} className="chartTick" x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>{fmtDate(points[i].date)}</text>)}
        {target != null && target > lo && target <= hi && <g><line className="chartTarget" x1={M.left} x2={width - M.right} y1={y(target)} y2={y(target)} /><text className="chartTick" x={width - M.right} y={y(target) - 5} textAnchor="end">Target {fmt(target)}</text></g>}
        {kind === "line" && <><path className="chartArea" d={areaPath} /><path className="chartLine" d={linePath} />
          {points.map((p, i) => p.value != null && (i === lastIdx || i === active || values.length < 12) ? <circle key={i} className="chartDot" cx={x(i)} cy={y(p.value)} r={4} /> : null)}
          {lastIdx >= 0 && <text className="chartValue" x={Math.min(x(lastIdx) + 8, width - M.right)} y={y(values.at(-1)!) - 8 < M.top + 10 ? y(values.at(-1)!) + 18 : y(values.at(-1)!) - 8} textAnchor={x(lastIdx) + 60 > width ? "end" : "start"}>{fmt(values.at(-1)!)}</text>}</>}
        {kind === "bar" && points.map((p, i) => p.value ? <path key={i} className={`chartBar${active === i ? " on" : ""}`} d={barPath(i, p.value)} /> : null)}
        {active != null && <line className="chartCross" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} />}
      </svg>}
      {act && width > 0 && <div className="chartTip" style={{ left: Math.min(Math.max(x(active!), 70), width - 70), top: 4 }}><strong>{act.value == null ? "No entry" : fmt(act.value)}</strong><span>{fmtDate(act.date)}</span></div>}
    </div>}
    {hasData && <details className="chartTable"><summary>Show data table</summary><table><thead><tr><th>Date</th><th>{title}</th></tr></thead><tbody>{points.filter((p) => p.value != null && (kind === "line" || p.value > 0)).map((p) => <tr key={p.date}><td>{fmtDate(p.date)}</td><td>{fmt(p.value!)}</td></tr>)}</tbody></table></details>}
  </div>;
}
