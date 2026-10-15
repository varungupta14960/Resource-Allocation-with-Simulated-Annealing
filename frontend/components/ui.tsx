"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export function PageHeader({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-gold-400 pb-4">
      <div className="max-w-3xl">
        <h1 className="text-[1.75rem] font-bold leading-tight">{title}</h1>
        {lead && <p className="mt-1 text-[0.95rem] text-ink-soft">{lead}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className = "", flush = false }:
  { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h2 className="text-[1.05rem] font-semibold leading-snug">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[0.8rem] text-ink-soft">{subtitle}</p>}
          </div>
          {actions && <div className="no-print flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "panel-body"}>{children}</div>
    </section>
  );
}

export function Figure({ label, value, note, tone = "default" }:
  { label: string; value: ReactNode; note?: ReactNode; tone?: "default" | "good" | "warn" }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-[0.75rem] font-semibold text-ink-soft">{label}</div>
      <div className={`font-serif text-[1.55rem] font-bold leading-tight tabular-nums ${tone === "good" ? "text-forest-700" : tone === "warn" ? "text-danger" : "text-forest-900"}`}>{value}</div>
      {note && <div className="mt-0.5 text-[0.72rem] leading-snug text-ink-soft">{note}</div>}
    </div>
  );
}

export function FigureStrip({ children, cols = 6 }: { children: ReactNode; cols?: number }) {
  const grid = cols === 6 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6" : cols === 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2 md:grid-cols-3";
  return <div className={`panel grid ${grid} divide-x divide-y divide-rule overflow-hidden [&>*]:border-rule`}>{children}</div>;
}

export function Alert({ kind = "info", children, title }: { kind?: "info" | "warn" | "error" | "ok"; children: ReactNode; title?: string }) {
  const s = { info: "border-forest-600 bg-mint-100", warn: "border-gold-500 bg-[#fff8d1]", error: "border-danger bg-[#fde9e7]", ok: "border-forest-700 bg-mint-200" }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`border-l-4 px-3.5 py-2.5 text-[0.88rem] ${s}`}>
      {title && <div className="font-semibold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.85rem] text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-forest-700 border-t-transparent" aria-hidden />
      {label}
    </span>
  );
}

export function NumInput({ value, onChange, step = "any", min, max, int = false, invalid = false, className = "", disabled = false, "aria-label": aria }:
  { value: number; onChange: (v: number) => void; step?: number | "any"; min?: number; max?: number; int?: boolean; invalid?: boolean; className?: string; disabled?: boolean; "aria-label"?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text) !== value) setText(Number.isFinite(value) ? String(value) : ""); /* eslint-disable-next-line */ }, [value]);
  const bad = invalid || text.trim() === "" || Number.isNaN(Number(text)) || (int && !Number.isInteger(Number(text)));
  return (
    <input type="number" inputMode="decimal" aria-label={aria} disabled={disabled} step={step} min={min} max={max} value={text}
      className={`input ${bad ? "invalid" : ""} ${className}`}
      onChange={(e) => { setText(e.target.value); const n = e.target.value.trim() === "" ? NaN : Number(e.target.value); onChange(n); }} />
  );
}

export function NeedsData({ what, href, cta }: { what: string; href: string; cta: string }) {
  return (
    <div className="border border-dashed border-forest-600 bg-white p-6 text-center">
      <p className="mb-3 text-ink-soft">{what}</p>
      <Link className="btn btn-primary" href={href}>{cta}</Link>
    </div>
  );
}

export function InitialTestBadge() {
  return <span className="badge badge-gold" title="Starting values from the methodology; they are not proven optimal and are meant to be tuned experimentally.">Initial Test Values</span>;
}

/* ------------------------------------------------------------------ formula explanations */
const TOPICS: Record<string, { title: string; body: ReactNode }> = {
  utility: { title: "Utility", body: (<>
    <p className="formula">u<sub>j</sub>(x<sub>j</sub>) = 0 if x<sub>j</sub> = 0;  v<sub>j</sub>(1 − e<sup>−k<sub>j</sub>x<sub>j</sub></sup>) if L<sub>j</sub> ≤ x<sub>j</sub> ≤ U<sub>j</sub></p>
    <p>Benefit of a funded project has <b>diminishing returns</b>: each extra work unit adds less than the one before. v<sub>j</sub> is the maximum benefit, k<sub>j</sub> the saturation rate. Total utility is U(x) = Σ<sub>j</sub> u<sub>j</sub>(x<sub>j</sub>).</p></>) },
  energy: { title: "Energy", body: (<>
    <p className="formula">E(x) = −U(x) + λ · Σ<sub>i</sub> max(0, (Σ<sub>j</sub> a<sub>ij</sub>x<sub>j</sub> − R<sub>i</sub>) / R<sub>i</sub>)</p>
    <p>SA <b>minimises</b> energy, so utility enters with a minus sign. The second term is zero for feasible allocations and grows with the relative amount by which a capacity is exceeded.</p></>) },
  penalty: { title: "Penalty", body: (<>
    <p className="formula">penalty = λ · Σ<sub>i</sub> max(0, (usage<sub>i</sub> − R<sub>i</sub>) / R<sub>i</sub>)</p>
    <p>Instead of forbidding infeasible neighbours, SA may pass through them at a cost. λ (initial test value 10 × max v<sub>j</sub>) makes a 10 % over-use of one resource cost about as much as the most valuable project is worth. Only <b>feasible</b> states can become the reported best.</p></>) },
  deltaE: { title: "ΔE", body: (<>
    <p className="formula">ΔE = E(x′) − E(x)</p>
    <p>The change in energy caused by a move. ΔE &lt; 0 means the neighbour is better (higher utility, less penalty); ΔE &gt; 0 means it is worse.</p></>) },
  acceptance: { title: "Acceptance probability", body: (<>
    <p><b>If ΔE ≤ 0:</b> accept the new solution.</p>
    <p><b>If ΔE &gt; 0:</b> accept with probability</p>
    <p className="formula">p = exp(−ΔE / T)</p>
    <p>At high T almost every move is accepted (exploration). As T falls, worse moves become unlikely (refinement). Accepting some worse solutions lets SA <b>escape local optima</b>.</p></>) },
  cooling: { title: "Cooling schedule", body: (<>
    <p className="formula">T ← α · T,  repeated while T &gt; T<sub>min</sub></p>
    <p>Geometric cooling. Levels visited = ⌈ln(T<sub>min</sub>/T<sub>0</sub>) / ln α⌉; each level runs a chain of moves. Slower cooling (α near 1) searches more but costs more time. Geometric cooling is a practical heuristic and carries no finite-time optimality guarantee.</p></>) },
  gap: { title: "Optimality gap", body: (<>
    <p className="formula">gap = (U<sub>exact</sub> − U<sub>SA</sub>) / U<sub>exact</sub> × 100 %</p>
    <p>Only defined when the exact optimum is known (small instances). It is never estimated for larger instances.</p></>) },
};

export function Explain({ topic, label }: { topic: keyof typeof TOPICS | string; label?: string }) {
  const t = TOPICS[topic];
  if (!t) return null;
  return (
    <span className="group relative inline-block align-baseline">
      <button type="button" aria-label={`Explain ${t.title}`} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-forest-700 text-[0.65rem] font-bold leading-none text-forest-700 hover:bg-mint-200">?</button>
      {label && <span className="ml-1 text-[0.72rem] text-forest-700 underline decoration-dotted">{label}</span>}
      <span className="invisible absolute left-0 top-6 z-30 w-[22rem] max-w-[85vw] border border-forest-700 bg-white p-3 text-left text-[0.8rem] font-normal normal-case leading-snug text-ink opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <span className="mb-1 block font-serif text-[0.95rem] font-bold text-forest-900">{t.title}</span>
        {t.body}
      </span>
    </span>
  );
}

export function ExplainGrid({ topics }: { topics: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {topics.map((k) => (
        <div key={k} className="border border-rule bg-mint-50 p-3 text-[0.85rem]">
          <div className="mb-1 font-serif text-[0.95rem] font-bold text-forest-900">{TOPICS[k].title}</div>
          {TOPICS[k].body}
        </div>
      ))}
    </div>
  );
}
