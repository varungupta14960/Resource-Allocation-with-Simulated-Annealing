"use client";
import { useMemo, useState } from "react";
import { BarCard, BoxPlot, C, LineCard } from "@/components/charts";
import { Alert, Figure, FigureStrip, NumInput, PageHeader, Panel, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { download, toCsv } from "@/lib/csv";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms } from "@/lib/format";
import { experimentStatements } from "@/lib/narrative";
import { useStore } from "@/lib/store";
import { validateProblem } from "@/lib/validate";

export default function ExperimentsPage() {
  const { problem, params, setParams, results, setResult, datasets, datasetId, loadDataset } = useStore();
  const [nRuns, setNRuns] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const e = results.experiment;
  const errors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);
  if (!problem) return <Spinner label="Loading dataset…" />;

  async function run() {
    setBusy(true); setErr(null);
    try { setResult("experiment", await api.experiment(problem!, params, nRuns, null, true)); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  const csv = () => e && download(`experiment_${e.n_runs}runs_seed${e.base_seed}.csv`, toCsv(e.runs.map((r) => ({
    dataset: problem.name, run: r.run, seed: r.seed, t0: e.params.t0, alpha: e.params.alpha, t_min: e.params.t_min, chain_length: e.params.chain_length,
    sa_utility: r.sa_utility, sa_energy: r.sa_energy, sa_feasible: r.sa_feasible, sa_runtime_ms: r.sa_runtime_ms, sa_iterations: r.sa_iterations,
    sa_best_found_iteration: r.sa_best_found_iteration, sa_mean_utilization: r.sa_mean_utilization, sa_gap_pct: r.sa_gap_pct ?? "n/a",
    random_utility: r.random_utility, random_runtime_ms: r.random_runtime_ms, random_gap_pct: r.random_gap_pct ?? "n/a",
    equal_utility: e.equal.utility, greedy_utility: e.greedy.utility, exact_utility: e.exact_utility ?? "n/a",
  }))));
  const box = (d: { min: number; q1: number; median: number; q3: number; max: number }, label: string, color: string) => ({ label, color, ...d });
  const conv = e ? e.convergence.iteration.map((it, i) => ({ iteration: it, mean: e.convergence.mean[i], min: e.convergence.min[i], max: e.convergence.max[i] })) : [];

  return (
    <>
      <PageHeader title="Experiments" lead="Independent SA runs with consecutive seeds (base seed + run index), compared with the random-feasible baseline per run and the deterministic baselines.">
        <button className="btn btn-primary" onClick={run} disabled={busy || errors.length > 0}>{busy ? "Running…" : `Run ${nRuns} experiments`}</button>
        <button className="btn btn-ghost" onClick={csv} disabled={!e}>Download Experiment CSV</button>
      </PageHeader>
      <Panel title="Experiment settings" subtitle="Change the problem size by choosing another dataset; change α and T₀ here or on the SA page." className="mb-6">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <label><span className="label">Number of runs (default 30)</span><NumInput int min={1} max={500} value={nRuns} onChange={setNRuns} /></label>
          <label><span className="label">Base random seed</span><NumInput int min={0} value={params.seed} onChange={(v) => setParams({ ...params, seed: v })} /></label>
          <label><span className="label">Initial temperature T₀</span><NumInput min={0} value={params.t0} onChange={(v) => setParams({ ...params, t0: v })} /></label>
          <label><span className="label">Cooling rate α</span><NumInput step={0.01} value={params.alpha} onChange={(v) => setParams({ ...params, alpha: v })} /></label>
          <label><span className="label">Chain length</span><NumInput int min={1} value={params.chain_length} onChange={(v) => setParams({ ...params, chain_length: v })} /></label>
          <label><span className="label">Dataset (problem size)</span>
            <select className="input" value={datasetId ?? ""} onChange={(ev) => ev.target.value && loadDataset(ev.target.value)}>
              {datasetId === null && <option value="">custom</option>}
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.id} (n={d.n_projects}, m={d.n_resources})</option>)}
            </select></label>
        </div>
        <p className="mt-2 text-[0.75rem] text-ink-soft">Seeds used: {params.seed} … {params.seed + nRuns - 1}. Large instances take longer because the random-feasible baseline draws as many samples as SA has evaluations in every run.</p>
      </Panel>
      {err && <div className="mb-4"><Alert kind="error" title="Run failed">{err}</Alert></div>}
      {busy && <Spinner label={`Running ${nRuns} SA runs and baselines on the backend…`} />}
      {e && !busy && (
        <div className="space-y-6">
          <FigureStrip>
            <Figure label="Mean utility" value={fmt(e.sa.utility.mean)} note={`std ${fmt(e.sa.utility.std, 3)}`} tone="good" />
            <Figure label="Best utility" value={fmt(e.sa.utility.max)} note={`seed ${e.best_run.seed}`} />
            <Figure label="Worst utility" value={fmt(e.sa.utility.min)} note={`seed ${e.worst_run.seed}`} />
            <Figure label="Median utility" value={fmt(e.sa.utility.median)} />
            <Figure label="Mean runtime" value={ms(e.sa.runtime_ms.mean)} note={`best ${ms(e.sa.runtime_ms.min)} · worst ${ms(e.sa.runtime_ms.max)}`} />
            <Figure label="Mean optimality gap" value={e.sa.gap_pct ? gapStr(e.sa.gap_pct.mean) : "n/a"} note={e.sa.gap_pct ? `optimum hit in ${e.sa.optimum_hits}/${e.n_runs} runs` : EXACT_UNAVAILABLE} />
          </FigureStrip>
          <Panel title="Summary statistics" subtitle={`${e.n_runs} runs · seeds ${e.seeds[0]}–${e.seeds[e.seeds.length - 1]} · T₀=${e.params.t0}, α=${e.params.alpha}, T_min=${e.params.t_min}, chain=${e.params.chain_length}, λ=${fmt(e.lam, 1)}`} flush>
            <table className="tbl">
              <thead><tr><th>Method</th><th className="num">Mean</th><th className="num">Median</th><th className="num">Std (sample)</th><th className="num">Best</th><th className="num">Worst</th><th className="num">Mean runtime</th><th className="num">Best / worst runtime</th></tr></thead>
              <tbody>
                <tr className="best"><td>Simulated Annealing ({e.n_runs} runs)</td><td className="num">{fmt(e.sa.utility.mean)}</td><td className="num">{fmt(e.sa.utility.median)}</td><td className="num">{fmt(e.sa.utility.std, 3)}</td><td className="num">{fmt(e.sa.utility.max)}</td><td className="num">{fmt(e.sa.utility.min)}</td><td className="num">{ms(e.sa.runtime_ms.mean)}</td><td className="num">{ms(e.sa.runtime_ms.min)} / {ms(e.sa.runtime_ms.max)}</td></tr>
                <tr><td>Random feasible (best of {e.random.samples.toLocaleString()}, {e.n_runs} runs)</td><td className="num">{fmt(e.random.utility.mean)}</td><td className="num">{fmt(e.random.utility.median)}</td><td className="num">{fmt(e.random.utility.std, 3)}</td><td className="num">{fmt(e.random.utility.max)}</td><td className="num">{fmt(e.random.utility.min)}</td><td className="num">{ms(e.random.runtime_ms.mean)}</td><td className="num">{ms(e.random.runtime_ms.min)} / {ms(e.random.runtime_ms.max)}</td></tr>
                <tr><td>Greedy (deterministic)</td><td className="num" colSpan={5}>{fmt(e.greedy.utility)}</td><td className="num">{ms(e.greedy.runtime_ms)}</td><td /></tr>
                <tr><td>Equal allocation (deterministic)</td><td className="num" colSpan={5}>{fmt(e.equal.utility)}</td><td className="num">{ms(e.equal.runtime_ms)}</td><td /></tr>
                {e.exact && <tr><td>Exact optimum</td><td className="num" colSpan={5}>{fmt(e.exact.utility)}</td><td className="num">{ms(e.exact.runtime_ms)}</td><td /></tr>}
              </tbody>
            </table>
            {!e.exact && <p className="p-3 text-[0.78rem] text-ink-soft">{EXACT_UNAVAILABLE}</p>}
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2">
            <BoxPlot title="Utility distribution across runs (box plot)" unit="utility"
              items={[box(e.sa.utility, "SA", C.dark), box(e.random.utility, "Random feasible", C.gold)]}
              markers={[{ label: "Greedy", value: e.greedy.utility, color: C.mid }, { label: "Equal", value: e.equal.utility, color: C.grey }, ...(e.exact ? [{ label: "Exact", value: e.exact.utility, color: C.purple }] : [])]}
              note="Box = Q1–Q3, thick line = median, whiskers = min/max over the runs. Dashed lines are the deterministic baselines." />
            <BarCard title="Utility distribution (histogram)" data={e.histogram.map((h) => ({ bin: `${h.lo.toFixed(1)}–${h.hi.toFixed(1)}`, sa: h.sa, random: h.random }))} xKey="bin"
              bars={[{ key: "sa", name: "SA runs", color: C.dark }, { key: "random", name: "Random runs", color: C.gold }]} yLabel="number of runs" />
            <BarCard title="Runtime comparison (mean)" data={[{ name: "SA", ms: Math.max(e.sa.runtime_ms.mean, 0.001) }, { name: "Random feasible", ms: Math.max(e.random.runtime_ms.mean, 0.001) }, { name: "Greedy", ms: Math.max(e.greedy.runtime_ms, 0.001) }, { name: "Equal", ms: Math.max(e.equal.runtime_ms, 0.001) }]}
              xKey="name" bars={[{ key: "ms", name: "ms", color: C.gold }]} logY yLabel="ms (log)" yFmt={(v) => (v < 1 ? v.toFixed(3) : v.toFixed(0))} />
            <LineCard title="Convergence: best utility so far (mean with min/max over runs)" data={conv} xKey="iteration" xLabel="iteration" yLabel="best utility"
              series={[{ key: "max", name: "max", color: C.mint, dash: "4 3" }, { key: "mean", name: "mean", color: C.dark, width: 2.4 }, { key: "min", name: "min", color: C.gold, dash: "4 3" }]} xFmt={(v) => v.toLocaleString()} />
            <BarCard title="Utility per run" data={e.runs.map((r) => ({ run: r.run, sa: r.sa_utility }))} xKey="run" bars={[{ key: "sa", name: "SA utility", color: C.green }]} zoom yLabel="utility" />
            {e.sa.gap_pct && <BarCard title="Optimality gap per run" data={e.runs.map((r) => ({ run: r.run, gap: r.sa_gap_pct ?? 0 }))} xKey="run" bars={[{ key: "gap", name: "gap (%)", color: C.red }]} yLabel="gap (%)" />}
          </div>
          <Panel title="Findings computed from this experiment">
            <ul className="list-disc space-y-1.5 pl-5 text-[0.9rem]">{experimentStatements(e).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </Panel>
          <Panel title="Per-run results" flush>
            <div className="max-h-96 overflow-auto"><table className="tbl">
              <thead className="sticky top-0"><tr><th className="num">Run</th><th className="num">Seed</th><th className="num">SA utility</th><th className="num">SA runtime</th><th className="num">Best found at iter.</th><th className="num">Gap</th><th className="num">Random utility</th></tr></thead>
              <tbody>{e.runs.map((r) => <tr key={r.run}><td className="num">{r.run}</td><td className="num">{r.seed}</td><td className="num">{fmt(r.sa_utility)}</td><td className="num">{ms(r.sa_runtime_ms)}</td><td className="num">{r.sa_best_found_iteration.toLocaleString()}</td><td className="num">{gapStr(r.sa_gap_pct)}</td><td className="num">{fmt(r.random_utility)}</td></tr>)}</tbody>
            </table></div>
          </Panel>
        </div>
      )}
    </>
  );
}
