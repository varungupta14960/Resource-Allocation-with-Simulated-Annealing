"use client";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Area } from "recharts";
import type { ReactNode } from "react";

export const C = { dark: "#0d3b26", green: "#1b6b49", mid: "#2a8160", mint: "#7fcfa8", gold: "#e6bd00", red: "#b3261e", grey: "#8aa196", purple: "#5b3f8c", teal: "#14708a" };
export const METHOD_COLORS: Record<string, string> = { sa: C.dark, equal: C.grey, greedy: C.mid, random: C.gold, exact: C.purple };
export const RES_COLORS = [C.dark, C.mint, C.gold, C.teal, C.purple, C.grey, C.red, C.mid];

const axisStyle = { fontSize: 11, fill: "#4b6156" };
const tip = { contentStyle: { fontSize: 12, border: "1px solid #1b6b49", borderRadius: 2 }, labelStyle: { fontWeight: 600 } };

export function ChartBox({ title, note, children, height = 260 }: { title: ReactNode; note?: ReactNode; children: ReactNode; height?: number }) {
  return (
    <figure className="border border-rule bg-white p-3">
      <figcaption className="mb-1 text-[0.85rem] font-semibold text-forest-900">{title}</figcaption>
      <div style={{ height }}>{children}</div>
      {note && <p className="mt-1 text-[0.72rem] text-ink-soft">{note}</p>}
    </figure>
  );
}

export interface Series { key: string; name: string; color: string; dash?: string; width?: number; step?: boolean; area?: boolean }

export function LineCard({ title, note, data, xKey, series, xLabel, yLabel, height = 260, logY = false, logX = false, yDomain, xFmt, yFmt, xType = "number", reverseX = false }:
  { title: ReactNode; note?: ReactNode; data: Record<string, number | string | null>[]; xKey: string; series: Series[]; xLabel?: string; yLabel?: string;
    height?: number; logY?: boolean; logX?: boolean; yDomain?: [number | string, number | string]; xFmt?: (v: number) => string; yFmt?: (v: number) => string; xType?: "number" | "category"; reverseX?: boolean }) {
  return (
    <ChartBox title={title} note={note} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 12, left: 4, bottom: 18 }}>
          <CartesianGrid stroke="#e3efe8" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} type={xType} scale={logX ? "log" : "auto"} domain={xType === "number" ? ["dataMin", "dataMax"] : undefined} reversed={reverseX}
            tick={axisStyle} tickFormatter={xFmt as never} label={{ value: xLabel, position: "insideBottom", offset: -10, fontSize: 11, fill: "#4b6156" }} />
          <YAxis tick={axisStyle} scale={logY ? "log" : "auto"} domain={yDomain ?? (logY ? ["auto", "auto"] : ["auto", "auto"])} tickFormatter={yFmt as never} width={56}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 6, fontSize: 11, fill: "#4b6156" }} allowDataOverflow />
          <Tooltip {...tip} formatter={((v: unknown) => (typeof v === "number" ? (yFmt ? yFmt(v) : v.toLocaleString("en-US", { maximumFractionDigits: 3 })) : String(v))) as never}
            labelFormatter={((l: unknown) => `${xLabel ?? xKey}: ${typeof l === "number" ? (xFmt ? xFmt(l) : l.toLocaleString("en-US", { maximumFractionDigits: 3 })) : String(l)}`) as never} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={22} />}
          {series.map((s) => s.area
            ? <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.12} strokeWidth={s.width ?? 1.5} dot={false} isAnimationActive={false} type="monotone" />
            : <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.width ?? 1.8} strokeDasharray={s.dash} dot={false}
                isAnimationActive={false} type={s.step ? "stepAfter" : "monotone"} connectNulls />)}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

export interface BarDef { key: string; name: string; color: string }

export function BarCard({ title, note, data, xKey, bars, yLabel, height = 260, yFmt, logY = false, zoom = false, colorBy, refY, stacked = false }:
  { title: ReactNode; note?: ReactNode; data: Record<string, number | string | null>[]; xKey: string; bars: BarDef[]; yLabel?: string; height?: number;
    yFmt?: (v: number) => string; logY?: boolean; zoom?: boolean; colorBy?: (row: Record<string, number | string | null>) => string; refY?: { y: number; label: string };
    stacked?: boolean }) {
  return (
    <ChartBox title={title} note={note} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="#e3efe8" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} interval={0} />
          <YAxis tick={axisStyle} scale={logY ? "log" : "auto"} domain={logY ? ["auto", "auto"] : zoom ? ["auto", "auto"] : [0, "auto"]} tickFormatter={yFmt as never} width={56}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 6, fontSize: 11, fill: "#4b6156" }} allowDataOverflow />
          <Tooltip {...tip} formatter={((v: unknown) => (typeof v === "number" ? (yFmt ? yFmt(v) : v.toLocaleString("en-US", { maximumFractionDigits: 3 })) : String(v))) as never} />
          {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={22} />}
          {refY && <ReferenceLine y={refY.y} stroke={C.red} strokeDasharray="4 3" label={{ value: refY.label, fontSize: 10, fill: C.red, position: "insideTopRight" }} />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} isAnimationActive={false} stackId={stacked ? "s" : undefined}>
              {colorBy && bars.length === 1 && data.map((row, i) => <Cell key={i} fill={colorBy(row)} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartBox>
  );
}

/* ----------------------------------------------------------------- box plot (five-number summary) */
export interface BoxItem { label: string; min: number; q1: number; median: number; q3: number; max: number; color: string }
export interface Marker { label: string; value: number; color: string }

export function BoxPlot({ title, note, items, markers = [], unit = "" }: { title: ReactNode; note?: ReactNode; items: BoxItem[]; markers?: Marker[]; unit?: string }) {
  const vals = [...items.flatMap((i) => [i.min, i.max]), ...markers.map((m) => m.value)];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.06;
  lo -= pad; hi += pad;
  const W = 760, left = 150, right = 20, rowH = 46, top = 12, plotW = W - left - right;
  const H = top + rowH * items.length + 46;
  const x = (v: number) => left + ((v - lo) / (hi - lo)) * plotW;
  const ticks = Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * i) / 5);
  const axisY = top + rowH * items.length + 4;
  return (
    <figure className="border border-rule bg-white p-3">
      <figcaption className="mb-1 text-[0.85rem] font-semibold text-forest-900">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={typeof title === "string" ? title : "Box plot"}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={axisY} stroke="#e3efe8" />
            <text x={x(t)} y={axisY + 14} textAnchor="middle" fontSize="11" fill="#4b6156">{t.toFixed(1)}</text>
          </g>
        ))}
        {markers.map((m, i) => (
          <g key={m.label}>
            <line x1={x(m.value)} x2={x(m.value)} y1={top} y2={axisY} stroke={m.color} strokeWidth="1.6" strokeDasharray="5 3" />
            <text x={x(m.value)} y={axisY + 28 + (i % 2) * 11} textAnchor="middle" fontSize="10.5" fill={m.color} fontWeight="600">{m.label} {m.value.toFixed(2)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cy = top + rowH * i + rowH / 2;
          return (
            <g key={it.label}>
              <text x={left - 10} y={cy + 4} textAnchor="end" fontSize="12" fill="#12261b" fontWeight="600">{it.label}</text>
              <line x1={x(it.min)} x2={x(it.max)} y1={cy} y2={cy} stroke={it.color} strokeWidth="1.6" />
              <line x1={x(it.min)} x2={x(it.min)} y1={cy - 8} y2={cy + 8} stroke={it.color} strokeWidth="1.6" />
              <line x1={x(it.max)} x2={x(it.max)} y1={cy - 8} y2={cy + 8} stroke={it.color} strokeWidth="1.6" />
              <rect x={x(it.q1)} y={cy - 12} width={Math.max(2, x(it.q3) - x(it.q1))} height={24} fill={it.color} fillOpacity="0.22" stroke={it.color} strokeWidth="1.6" />
              <line x1={x(it.median)} x2={x(it.median)} y1={cy - 12} y2={cy + 12} stroke={it.color} strokeWidth="3" />
              <title>{`${it.label}: min ${it.min.toFixed(3)}, Q1 ${it.q1.toFixed(3)}, median ${it.median.toFixed(3)}, Q3 ${it.q3.toFixed(3)}, max ${it.max.toFixed(3)} ${unit}`}</title>
            </g>
          );
        })}
      </svg>
      {note && <p className="mt-1 text-[0.72rem] text-ink-soft">{note}</p>}
    </figure>
  );
}

/* ----------------------------------------------------------------- heatmap */
export function Heatmap({ title, note, rowLabels, colLabels, values, fmt, better, rowTitle, colTitle, highlight }:
  { title: ReactNode; note?: ReactNode; rowLabels: string[]; colLabels: string[]; values: (number | null)[][]; fmt: (v: number) => string;
    better: "high" | "low"; rowTitle: string; colTitle: string; highlight?: [number, number] }) {
  const flat = values.flat().filter((v): v is number => v !== null);
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const shade = (v: number | null) => {
    if (v === null) return "#f1f4f2";
    let t = hi - lo < 1e-12 ? 0.5 : (v - lo) / (hi - lo);
    if (better === "low") t = 1 - t;
    // light mint (#e6f6ed) -> dark green (#1b6b49)
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    return `rgb(${mix(230, 27)}, ${mix(246, 107)}, ${mix(237, 73)})`;
  };
  const textOn = (v: number | null) => {
    if (v === null) return "#4b6156";
    let t = hi - lo < 1e-12 ? 0.5 : (v - lo) / (hi - lo);
    if (better === "low") t = 1 - t;
    return t > 0.55 ? "#fff" : "#12261b";
  };
  return (
    <figure className="border border-rule bg-white p-3">
      <figcaption className="mb-2 text-[0.85rem] font-semibold text-forest-900">{title}</figcaption>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-center text-[0.82rem] tabular-nums">
          <thead>
            <tr><th className="text-left text-[0.72rem] font-semibold text-ink-soft">{rowTitle} ↓ / {colTitle} →</th>
              {colLabels.map((c) => <th key={c} className="text-[0.78rem] font-semibold text-forest-900">{c}</th>)}</tr>
          </thead>
          <tbody>
            {values.map((row, r) => (
              <tr key={r}>
                <th className="text-left text-[0.78rem] font-semibold text-forest-900">{rowLabels[r]}</th>
                {row.map((v, c) => (
                  <td key={c} style={{ background: shade(v), color: textOn(v), outline: highlight && highlight[0] === r && highlight[1] === c ? "3px solid #ffd60a" : undefined, outlineOffset: -3 }}
                    className="px-2 py-2.5 font-semibold">{v === null ? "n/a" : fmt(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-1 text-[0.72rem] text-ink-soft">{note}</p>}
    </figure>
  );
}
