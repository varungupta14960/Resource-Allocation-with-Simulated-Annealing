"use client";
import { useMemo, useState } from "react";
import { C, Heatmap, LineCard, RES_COLORS } from "@/components/charts";
import { Alert, Explain, NumInput, PageHeader, Panel, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { download, toCsv } from "@/lib/csv";
import { EXACT_UNAVAILABLE, fmt, ms } from "@/lib/format";
import { sensitivityStatements } from "@/lib/narrative";
import { useStore } from "@/lib/store";
import { validateProblem } from "@/lib/validate";

const ALPHAS = [0.9, 0.95, 0.99];
const T0S = [10, 50, 100, 200];

export default function SensitivityPage() {
  const { problem, params, results, setResult } = useStore();
  const [alphas, setAlphas] = useState<number[]>(ALPHAS);
  const [t0s, setT0s] = useState<number[]>(T0S);
  const [runs, setRuns] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fixAlpha, setFixAlpha] = useState(0.95);
  const [fixT0, setFixT0] = useState(50);
  const s = results.sensitivity;
  const errors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);
  if (!problem) return <Spinner label="Loading dataset…" />;
  const toggle = (arr: number[], v: number, set: (a: number[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].sort((a, b) => a - b));

  async function run() {
    setBusy(true); setErr(null);
    try { const r = await api.sensitivity(problem!, params, alphas, t0s, runs); setResult("sensitivity", r); setFixAlpha(r.alphas.includes(0.95) ? 0.95 : r.alphas[0]); setFixT0(r.t0s.includes(50) ? 50 : r.t0s[0]); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  const grid = (key: "mean_utility" | "mean_runtime_ms" | "mean_gap_pct") =>
    s ? s.alphas.map((a) => s.t0s.map((t) => s.configs.find((c) => c.alpha === a && c.t0 === t)![key])) : [];
  const bi = s ? [s.alphas.indexOf(s.best_config.alpha), s.t0s.indexOf(s.best_config.t0)] as [number, number] : undefined;
  const lineData = (byAlpha: boolean) => {
    if (!s) return [];
    const keys = byAlpha ? s.t0s : s.alphas;
    return keys.map((k) => {
      const row: Record<string, number> = { x: k };
      (byAlpha ? s.alphas : s.t0s).forEach((o) => { const c = s.configs.find((q) => (byAlpha ? q.t0 === k && q.alpha === o : q.alpha === k && q.t0 === o))!; row[`s${o}`] = c.mean_utility; row[`r${o}`] = c.mean_runtime_ms; row[`g${o}`] = c.mean_gap_pct ?? NaN; });
      return row;
    });
  };
  const conv = (fix: "alpha" | "t0") => {
    if (!s) return { data: [], series: [] };
    const cfgs = s.configs.filter((c) => (fix === "alpha" ? c.alpha === fixAlpha : c.t0 === fixT0));
    const data = s.progress.map((p, i) => { const r: Record<string, number> = { progress: +(p * 100).toFixed(1) }; cfgs.forEach((c, k) => { r[`c${k}`] = c.convergence[i]; }); return r; });
    return { data, series: cfgs.map((c, k) => ({ key: `c${k}`, name: fix === "alpha" ? `T₀=${c.t0}` : `α=${c.alpha}`, color: RES_COLORS[k % RES_COLORS.length], width: 2 })) };
  };
  const cA = conv("alpha"), cT = conv("t0");

  return (
    <>
      <PageHeader title="Parameter Sensitivity" lead="A real grid of SA runs over cooling rate α and initial temperature T₀. Same seeds for every configuration, so differences come from the parameters, not from luck.">
        <button className="btn btn-primary" onClick={run} disabled={busy || errors.length > 0 || !alphas.length || !t0s.length}>{busy ? "Running…" : "Run sensitivity experiment"}</button>
        <button className="btn btn-ghost" disabled={!s} onClick={() => s && download("parameter_sensitivity.csv", toCsv(s.configs.map(({ convergence, ...c }) => ({ dataset: problem.name, seed: s.seed, ...c }))))}>Download CSV</button>
      </PageHeader>
      <Panel title="Grid" className="mb-6" subtitle="Cooling rate α and initial temperature T₀ (the other SA parameters come from the SA page)">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 text-[0.85rem]">
          <div><span className="label">Cooling rate α <Explain topic="cooling" /></span><div className="flex gap-3">{ALPHAS.map((a) => <label key={a} className="flex items-center gap-1"><input type="checkbox" checked={alphas.includes(a)} onChange={() => toggle(alphas, a, setAlphas)} />{a.toFixed(2)}</label>)}</div></div>
          <div><span className="label">Initial temperature T₀</span><div className="flex gap-3">{T0S.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={t0s.includes(t)} onChange={() => toggle(t0s, t, setT0s)} />{t}</label>)}</div></div>
          <label><span className="label">Runs per configuration</span><NumInput int min={1} max={30} className="w-24" value={runs} onChange={setRuns} /></label>
          <span className="text-[0.75rem] text-ink-soft">Seeds {params.seed}…{params.seed + runs - 1} · α=0.99 is about 5× slower than α=0.95 · {alphas.length * t0s.length} configurations × {runs} runs</span>
        </div>
      </Panel>
      {err && <div className="mb-4"><Alert kind="error" title="Run failed">{err}</Alert></div>}
      {busy && <Spinner label="Running the parameter grid on the backend…" />}
      {s && !busy && (
        <div className="space-y-6">
          <Alert kind="ok" title={s.best_config.label}>
            α = <b>{s.best_config.alpha}</b>, T₀ = <b>{s.best_config.t0}</b>: mean utility {fmt(s.best_config.mean_utility)}, mean runtime {ms(s.best_config.mean_runtime_ms)}.
            {s.best_config.tied_on_utility > 1 && <> {s.best_config.tied_on_utility} configurations tied on mean utility; the fastest is shown.</>} This describes this dataset and these seeds only and is not a claim of a globally optimal setting.
          </Alert>
          <div className="grid gap-4 xl:grid-cols-2">
            <Heatmap title="Mean final utility (higher is better)" rowTitle="α" colTitle="T₀" rowLabels={s.alphas.map(String)} colLabels={s.t0s.map(String)} values={grid("mean_utility")} fmt={(v) => v.toFixed(2)} better="high" highlight={bi} note="Gold outline = best observed configuration." />
            <Heatmap title="Mean runtime (lower is faster)" rowTitle="α" colTitle="T₀" rowLabels={s.alphas.map(String)} colLabels={s.t0s.map(String)} values={grid("mean_runtime_ms")} fmt={(v) => ms(v)} better="low" highlight={bi} />
            {s.exact_utility !== null
              ? <Heatmap title={<>Mean optimality gap % (lower is better) <Explain topic="gap" /></>} rowTitle="α" colTitle="T₀" rowLabels={s.alphas.map(String)} colLabels={s.t0s.map(String)} values={grid("mean_gap_pct")} fmt={(v) => `${v.toFixed(3)}%`} better="low" highlight={bi} note={`Exact optimum = ${fmt(s.exact_utility)}`} />
              : <Panel title="Optimality gap"><p className="text-[0.9rem] text-ink-soft">{EXACT_UNAVAILABLE} Load the small or toy dataset to see gaps.</p></Panel>}
            <LineCard title="Utility vs T₀ (one line per α)" data={lineData(true)} xKey="x" xLabel="T₀" yLabel="mean utility" series={s.alphas.map((a, k) => ({ key: `s${a}`, name: `α=${a}`, color: RES_COLORS[k], width: 2 }))} />
            <LineCard title="Utility vs α (one line per T₀)" data={lineData(false)} xKey="x" xLabel="α" yLabel="mean utility" series={s.t0s.map((t, k) => ({ key: `s${t}`, name: `T₀=${t}`, color: RES_COLORS[k], width: 2 }))} />
            <LineCard title="Runtime vs α (one line per T₀)" data={lineData(false)} xKey="x" xLabel="α" yLabel="mean runtime (ms)" series={s.t0s.map((t, k) => ({ key: `r${t}`, name: `T₀=${t}`, color: RES_COLORS[k], width: 2 }))} />
            <LineCard title="Runtime vs T₀ (one line per α)" data={lineData(true)} xKey="x" xLabel="T₀" yLabel="mean runtime (ms)" series={s.alphas.map((a, k) => ({ key: `r${a}`, name: `α=${a}`, color: RES_COLORS[k], width: 2 }))} />
          </div>
          <Panel title="Convergence comparison" subtitle="Mean best-utility-so-far against the % of each run completed (runs with different α have different lengths, so progress is normalised)">
            <div className="mb-3 flex flex-wrap gap-6 text-[0.85rem]">
              <label>Fix α = <select className="input inline-block w-24" value={fixAlpha} onChange={(e) => setFixAlpha(Number(e.target.value))}>{s.alphas.map((a) => <option key={a}>{a}</option>)}</select></label>
              <label>Fix T₀ = <select className="input inline-block w-24" value={fixT0} onChange={(e) => setFixT0(Number(e.target.value))}>{s.t0s.map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <LineCard title={`Varying T₀ at α = ${fixAlpha}`} data={cA.data} xKey="progress" xLabel="% of run completed" yLabel="best utility" series={cA.series} />
              <LineCard title={`Varying α at T₀ = ${fixT0}`} data={cT.data} xKey="progress" xLabel="% of run completed" yLabel="best utility" series={cT.series} />
            </div>
          </Panel>
          <Panel title="All configurations" flush>
            <table className="tbl"><thead><tr><th className="num">α</th><th className="num">T₀</th><th className="num">Mean utility</th><th className="num">Std</th><th className="num">Best</th><th className="num">Worst</th><th className="num">Mean runtime</th><th className="num">Iterations</th><th className="num">Gap</th><th className="num">Optimum hits</th></tr></thead>
              <tbody>{s.configs.map((c) => <tr key={`${c.alpha}-${c.t0}`} className={c.alpha === s.best_config.alpha && c.t0 === s.best_config.t0 ? "best" : ""}>
                <td className="num">{c.alpha}</td><td className="num">{c.t0}</td><td className="num">{fmt(c.mean_utility)}</td><td className="num">{fmt(c.std_utility, 3)}</td><td className="num">{fmt(c.best_utility)}</td><td className="num">{fmt(c.worst_utility)}</td>
                <td className="num">{ms(c.mean_runtime_ms)}</td><td className="num">{c.mean_iterations.toLocaleString()}</td><td className="num">{c.mean_gap_pct === null ? "n/a" : `${c.mean_gap_pct.toFixed(3)}%`}</td><td className="num">{c.optimum_hits === null ? "n/a" : `${c.optimum_hits}/${c.runs}`}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Findings computed from this experiment"><ul className="list-disc space-y-1.5 pl-5 text-[0.9rem]">{sensitivityStatements(s).map((t, i) => <li key={i}>{t}</li>)}</ul></Panel>
        </div>
      )}
    </>
  );
}
