"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { C, LineCard } from "@/components/charts";
import { Alert, NumInput, PageHeader, Panel, Spinner } from "@/components/ui";
import { fmt, gapStr, ms } from "@/lib/format";
import { allStatements } from "@/lib/narrative";
import { runPipeline, STAGES, type StageId } from "@/lib/pipeline";
import { useStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";

type St = { state: "idle" | "running" | "done" | "error"; info?: string };

function Demo() {
  const { problem, params, setParams, results, setResult, loadDataset, datasets, datasetId } = useStore();
  const [stages, setStages] = useState<Record<StageId, St>>(Object.fromEntries(STAGES.map((s) => [s.id, { state: "idle" }])) as Record<StageId, St>);
  const [running, setRunning] = useState(false);
  const [ds, setDs] = useState("small");
  const [nRuns, setNRuns] = useState(30);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);
  const auto = useSearchParams().get("auto");

  async function start() {
    setRunning(true); setErr(null);
    setStages(Object.fromEntries(STAGES.map((s) => [s.id, { state: "idle" }])) as Record<StageId, St>);
    try {
      setStages((s) => ({ ...s, load: { state: "running" } }));
      const p = await loadDataset(ds);
      await runPipeline({
        problem: p, params, nRuns, sensRuns: 3,
        onStage: (id, state, info) => setStages((s) => ({ ...s, [id]: { state, info } })),
        onResult: (k, v) => setResult(k, v),
      });
    } catch (e) { setErr((e as Error).message); }
    setRunning(false);
  }
  useEffect(() => {
    if (auto && !started.current && problem) { started.current = true; setDs(datasetId ?? "small"); void start(); }
    // eslint-disable-next-line
  }, [auto, problem]);

  const cmp = results.compare;
  return (
    <>
      <PageHeader title="Professor Demo Mode" lead="One click runs the whole methodology on a reproducible dataset: validate, SA, baselines, exact optimum (if small), independent runs, sensitivity, and the generated analysis.">
        <button className="btn btn-gold" onClick={start} disabled={running}>{running ? "Running…" : "Start demonstration"}</button>
      </PageHeader>
      <Panel title="Demo settings" className="mb-6">
        <div className="flex flex-wrap items-end gap-6 text-[0.85rem]">
          <label><span className="label">Dataset</span><select className="input" value={ds} disabled={running} onChange={(e) => setDs(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.id} – {d.role}</option>)}</select></label>
          <label><span className="label">Seed (reproducible)</span><NumInput int min={0} className="w-28" value={params.seed} disabled={running} onChange={(v) => setParams({ ...params, seed: v })} /></label>
          <label><span className="label">Independent runs</span><NumInput int min={1} max={100} className="w-24" value={nRuns} disabled={running} onChange={setNRuns} /></label>
          <p className="max-w-md text-[0.75rem] text-ink-soft">“small” enables the exact optimum and optimality gap. Same dataset + same seed always reproduces the same numbers.</p>
        </div>
      </Panel>
      {err && <div className="mb-4"><Alert kind="error" title="Demonstration stopped">{err}</Alert></div>}
      <Panel title="Progress" className="mb-6" flush>
        <ol className="divide-y divide-rule">
          {STAGES.map((s, i) => { const st = stages[s.id]; return (
            <li key={s.id} className="flex items-center gap-4 px-4 py-2.5">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold ${st.state === "done" ? "bg-forest-700 text-white" : st.state === "error" ? "bg-danger text-white" : "bg-mint-200 text-forest-900"}`}>{st.state === "done" ? "✓" : i + 1}</span>
              <div className="flex-1"><div className="font-semibold">{s.label}</div><div className="text-[0.78rem] text-ink-soft">{s.detail}</div></div>
              <div className="text-right text-[0.78rem] text-ink-soft">{st.state === "running" ? <Spinner label="running" /> : st.info}</div>
            </li>); })}
        </ol>
      </Panel>
      {cmp && (
        <div className="space-y-6">
          <Panel title="Convergence (SA, from the backend history)">
            <LineCard title="Best vs current utility" data={cmp.sa_run.history.map((h) => ({ iteration: h.iteration, current: h.current_utility, best: h.best_utility }))} xKey="iteration" xLabel="iteration" yLabel="utility" height={220}
              series={[{ key: "current", name: "current", color: C.mint }, { key: "best", name: "best feasible", color: C.dark, width: 2.2 }]} xFmt={(v) => v.toLocaleString()} />
          </Panel>
          <Panel title="Final comparison" flush>
            <table className="tbl"><thead><tr><th>Method</th><th className="num">Utility</th><th className="num">Runtime</th><th className="num">Utilization</th><th className="num">Violations</th><th className="num">Gap</th></tr></thead>
              <tbody>{cmp.methods.map((m) => <tr key={m.key} className={cmp.best_methods_tied.includes(m.method) ? "best" : ""}><td>{m.method}</td><td className="num">{fmt(m.utility)}</td><td className="num">{ms(m.runtime_ms)}</td><td className="num">{(m.mean_utilization * 100).toFixed(1)}%</td><td className="num">{m.n_violations}</td><td className="num">{gapStr(m.optimality_gap_pct)}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Results summary (generated from the numbers above)">
            <ul className="list-disc space-y-1.5 pl-5 text-[0.9rem]">{allStatements(results).map((s, i) => <li key={i}>{s}</li>)}</ul>
          </Panel>
          <div className="flex flex-wrap gap-2">{[["/sa", "SA page"], ["/compare", "Baseline comparison"], ["/exact", "Exact optimum"], ["/experiments", "Experiments"], ["/sensitivity", "Sensitivity"], ["/results", "Results & Analysis"], ["/conclusion", "Conclusion"]].map(([h, l]) => <Link key={h} href={h} className="btn btn-ghost">{l}</Link>)}</div>
        </div>
      )}
    </>
  );
}

export default function DemoPage() { return <Suspense fallback={<Spinner label="Loading…" />}><Demo /></Suspense>; }
