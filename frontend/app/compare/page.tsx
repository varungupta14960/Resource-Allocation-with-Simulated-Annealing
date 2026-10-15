"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { UsageChart } from "@/components/AllocationTable";
import { BarCard, C, METHOD_COLORS, RES_COLORS } from "@/components/charts";
import { Alert, Explain, NeedsData, NumInput, PageHeader, Panel, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { download, toCsv } from "@/lib/csv";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms } from "@/lib/format";
import { useStore } from "@/lib/store";
import { validateProblem } from "@/lib/validate";

export default function ComparePage() {
  const { problem, params, results, setResult } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [samples, setSamples] = useState(1000);
  const [runExact, setRunExact] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [logRt, setLogRt] = useState(true);
  const cmp = results.compare;
  const errors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);

  if (!problem) return <Spinner label="Loading dataset…" />;
  async function run() {
    setBusy(true); setErr(null);
    try {
      const r = await api.compare(problem!, params, auto ? null : samples, runExact);
      setResult("compare", r); setResult("sa", r.sa_run);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const rows = cmp?.methods ?? [];
  const bestKeys = new Set(rows.filter((m) => cmp!.best_methods_tied.includes(m.method)).map((m) => m.key));
  const chartRows = rows.map((m) => ({ name: m.method.replace(" (best of N)", "").replace(" (exhaustive)", "").replace(" Allocation", ""), key: m.key, utility: m.utility, runtime: Math.max(m.runtime_ms, 0.001), util: m.mean_utilization * 100,
    ...Object.fromEntries(problem.resources.map((r, i) => [`r${i}`, m.utilization[i] * 100])) }));

  return (
    <>
      <PageHeader title="Baseline Comparison" lead="Simulated Annealing against equal, greedy and random-feasible allocation, plus the exact optimum when the instance is small enough. Same instance, same seed, same energy function.">
        <button className="btn btn-primary" onClick={run} disabled={busy || errors.length > 0}>{busy ? "Running…" : "Run all methods"}</button>
        {cmp && <button className="btn btn-ghost" onClick={() => download("results_comparison.csv", toCsv(rows.map((m) => ({
          method: m.method, utility: m.utility, energy: m.energy, runtime_ms: m.runtime_ms, mean_utilization: m.mean_utilization, constraint_violations: m.n_violations,
          optimality_gap_pct: m.optimality_gap_pct ?? "n/a", evaluations: m.evaluations ?? "", seed: cmp.seed, dataset: problem.name, allocation: m.allocation.join(" "),
        }))))}>Download Results CSV</button>}
      </PageHeader>

      <Panel title="Settings" className="mb-6">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 text-[0.85rem]">
          <div>SA parameters: T₀={params.t0}, α={params.alpha}, T<sub>min</sub>={params.t_min}, chain={params.chain_length}, seed={params.seed} <Link className="ml-2 text-forest-700 underline" href="/sa">edit</Link></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Random-feasible budget = SA evaluations</label>
          {!auto && <label className="flex items-center gap-2">Samples <NumInput int min={1} className="w-28" value={samples} onChange={setSamples} /></label>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={runExact} onChange={(e) => setRunExact(e.target.checked)} />Compute exact optimum if feasible</label>
        </div>
        {errors.length > 0 && <div className="mt-3"><Alert kind="error">{errors[0]}</Alert></div>}
      </Panel>
      {err && <div className="mb-4"><Alert kind="error" title="Run failed">{err}</Alert></div>}
      {busy && <div className="mb-4"><Spinner label="Running every method on the backend…" /></div>}
      {!cmp && !busy && <NeedsData what="No comparison has been run for this dataset yet." href="#" cta="Use “Run all methods” above" />}

      {cmp && (
        <div className="space-y-6">
          <Panel title="Comparison table" subtitle={`Dataset “${problem.name}” · seed ${cmp.seed} · λ = ${fmt(cmp.lam, 1)} · random-feasible budget ${cmp.random_samples.toLocaleString()} samples`}
            actions={<span className="text-[0.75rem] text-ink-soft">Highlighted row = highest utility among feasible methods</span>} flush>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Method</th><th className="num">Utility</th><th className="num">Energy <Explain topic="energy" /></th><th className="num">Runtime</th><th className="num">Evaluations</th><th className="num">Utilization</th><th className="num">Constraint violations</th><th className="num">Optimality gap <Explain topic="gap" /></th></tr></thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.key} className={bestKeys.has(m.key) ? "best" : ""}>
                      <td>{m.method} {bestKeys.has(m.key) && <span className="badge badge-gold ml-1">{bestKeys.size > 1 ? "best (tie)" : "best"}</span>}</td>
                      <td className="num">{fmt(m.utility)}</td><td className="num">{fmt(m.energy)}</td><td className="num">{ms(m.runtime_ms)}</td>
                      <td className="num">{m.evaluations?.toLocaleString() ?? "—"}</td><td className="num">{(m.mean_utilization * 100).toFixed(1)}%</td>
                      <td className="num">{m.n_violations === 0 ? <span className="badge badge-green">0</span> : <span className="badge badge-red">{m.n_violations}</span>}</td>
                      <td className="num">{gapStr(m.optimality_gap_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 p-3 text-[0.78rem] text-ink-soft">
              {!cmp.exact && <p>{EXACT_UNAVAILABLE} {cmp.exact_status.reason && cmp.exact_status.reason !== EXACT_UNAVAILABLE ? cmp.exact_status.reason : ""}</p>}
              {rows.map((m) => m.note && <p key={m.key}><b>{m.method}:</b> {m.note}</p>)}
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <BarCard title="Utility comparison" data={chartRows} xKey="name" bars={[{ key: "utility", name: "Total utility", color: C.green }]} colorBy={(r) => METHOD_COLORS[r.key as string] ?? C.green} zoom={zoom} yLabel="total utility" yFmt={(v) => v.toFixed(0)} />
              <label className="mt-1 flex items-center gap-2 text-[0.75rem] text-ink-soft"><input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} />Zoom the y-axis to the data range (differences look larger when zoomed)</label>
            </div>
            <div>
              <BarCard title="Runtime comparison" data={chartRows} xKey="name" bars={[{ key: "runtime", name: "Runtime (ms)", color: C.gold }]} colorBy={(r) => METHOD_COLORS[r.key as string] ?? C.gold} logY={logRt} yLabel={logRt ? "ms (log scale)" : "ms"} yFmt={(v) => (v < 1 ? v.toFixed(3) : v.toFixed(0))} />
              <label className="mt-1 flex items-center gap-2 text-[0.75rem] text-ink-soft"><input type="checkbox" checked={logRt} onChange={(e) => setLogRt(e.target.checked)} />Logarithmic runtime axis (runtimes differ by orders of magnitude)</label>
            </div>
            <BarCard title="Resource utilization by method" data={chartRows} xKey="name" bars={problem.resources.map((r, i) => ({ key: `r${i}`, name: r.name, color: RES_COLORS[i % RES_COLORS.length] }))} yLabel="% of capacity" yFmt={(v) => `${v.toFixed(0)}%`} refY={{ y: 100, label: "capacity" }} />
            {cmp.exact && (
              <BarCard title="Optimality gap vs exact optimum" data={rows.filter((m) => m.key !== "exact").map((m) => ({ name: m.method.replace(" (best of N)", "").replace(" Allocation", ""), key: m.key, gap: m.optimality_gap_pct ?? 0 }))} xKey="name"
                bars={[{ key: "gap", name: "Gap (%)", color: C.red }]} colorBy={(r) => METHOD_COLORS[r.key as string]} yLabel="gap (%)" yFmt={(v) => `${v.toFixed(2)}%`} />
            )}
            <UsageChart problem={problem} result={cmp.methods[0]} title="Resource usage vs capacity: Simulated Annealing" />
          </div>

          <Panel title="Allocations by method" subtitle="Work units x_j assigned by each method" flush>
            <div className="max-h-[26rem] overflow-auto">
              <table className="tbl">
                <thead className="sticky top-0"><tr><th>Project</th>{rows.map((m) => <th key={m.key} className="num">{m.method.split(" (")[0]}</th>)}</tr></thead>
                <tbody>
                  {problem.projects.map((p, j) => (
                    <tr key={j}><td>{p.name}</td>{rows.map((m) => <td key={m.key} className={`num ${m.allocation[j] === 0 ? "text-ink-soft" : "font-semibold"}`}>{m.allocation[j]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
