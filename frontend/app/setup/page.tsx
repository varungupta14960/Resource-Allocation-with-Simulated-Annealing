"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, NumInput, Panel, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { download } from "@/lib/csv";
import { fmt, sci } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ProblemData, ValidateResult } from "@/lib/types";
import { validateProblem } from "@/lib/validate";

export default function SetupPage() {
  const { problem, setProblem, datasets, datasetId, loadDataset } = useStore();
  const [server, setServer] = useState<ValidateResult | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState({ n: 15, m: 3, seed: 1 });
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const errors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);

  useEffect(() => {
    if (!problem || errors.length) { setServer(null); return; }
    const t = setTimeout(() => {
      api.validate(problem).then((v) => { setServer(v); setServerErr(null); }).catch((e) => { setServer(null); setServerErr((e as Error).message); });
    }, 400);
    return () => clearTimeout(t);
  }, [problem, errors.length]);

  if (!problem) return <Spinner label="Loading dataset…" />;
  const edit = (fn: (p: ProblemData) => ProblemData) => setProblem(fn(structuredClone(problem)), null);
  const load = async (id: string) => { setBusy(true); setMsg(null); try { await loadDataset(id); setMsg(`Loaded dataset '${id}'.`); } catch (e) { setMsg((e as Error).message); } setBusy(false); };

  const addProject = () => edit((p) => { p.projects.push({ name: `Project ${p.projects.length + 1}`, L: 1, U: 5, v: 50, k: 0.3 }); p.consumption.forEach((r) => r.push(1)); return p; });
  const delProject = (j: number) => edit((p) => { p.projects.splice(j, 1); p.consumption.forEach((r) => r.splice(j, 1)); return p; });
  const addResource = () => edit((p) => { p.resources.push({ name: `Resource ${p.resources.length + 1}`, capacity: 100 }); p.consumption.push(p.projects.map(() => 1)); return p; });
  const delResource = (i: number) => edit((p) => { p.resources.splice(i, 1); p.consumption.splice(i, 1); return p; });

  return (
    <>
      <PageHeader title="Problem Setup" lead="Choose a built-in dataset or edit every parameter of the model. Validation runs as you type; the server adds feasibility diagnostics.">
        <button className="btn btn-ghost" onClick={() => download(`${problem.name.replace(/\W+/g, "_")}.json`, JSON.stringify(problem, null, 2), "application/json")}>Export JSON</button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try { const d = JSON.parse(await f.text()); setProblem({ name: d.name ?? f.name, projects: d.projects, resources: d.resources, consumption: d.consumption }, null); setMsg(`Imported ${f.name}.`); } catch { setMsg("Could not read that file: expected the JSON produced by Export."); }
          e.target.value = "";
        }} />
      </PageHeader>

      <Panel title="Example datasets" subtitle="“Load Example Dataset” replaces the current problem and clears stale results." className="mb-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {datasets.map((d) => (
            <div key={d.id} className={`flex flex-col border p-3 ${datasetId === d.id ? "border-forest-700 bg-mint-100" : "border-rule"}`}>
              <div className="flex items-center justify-between"><b className="font-serif text-[1.05rem] capitalize">{d.id}</b><span className="badge badge-green">{d.role}</span></div>
              <p className="mt-1 flex-1 text-[0.8rem] text-ink-soft">{d.description}</p>
              <p className="mt-2 text-[0.76rem] tabular-nums">n = {d.n_projects}, m = {d.n_resources} · search space {sci(d.search_space_log10, d.search_space)}</p>
              <button className="btn btn-primary mt-2" disabled={busy} onClick={() => load(d.id)}>{datasetId === d.id ? "Reload" : "Load Example Dataset"}</button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule pt-4">
          <div><div className="label">Synthetic: projects</div><NumInput int min={1} className="w-24" value={gen.n} onChange={(n) => setGen({ ...gen, n })} /></div>
          <div><div className="label">resources (1–8)</div><NumInput int min={1} max={8} className="w-24" value={gen.m} onChange={(m) => setGen({ ...gen, m })} /></div>
          <div><div className="label">generator seed</div><NumInput int min={0} className="w-24" value={gen.seed} onChange={(seed) => setGen({ ...gen, seed })} /></div>
          <button className="btn btn-ghost" disabled={busy} onClick={async () => {
            setBusy(true); try { const p = await api.generate(gen.n, gen.m, gen.seed); setProblem(p, null); setMsg(`Generated ${gen.n} projects × ${gen.m} resources (seed ${gen.seed}).`); } catch (e) { setMsg((e as Error).message); } setBusy(false);
          }}>Generate custom-size instance</button>
          <p className="max-w-md text-[0.75rem] text-ink-soft">Categories (infrastructure, software, labs, teaching …) supply realistic benefit and consumption profiles; the same seed always gives the same instance.</p>
        </div>
        {msg && <div className="mt-3"><Alert kind="info">{msg}</Alert></div>}
      </Panel>

      <div className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Panel title="Projects" subtitle="x_j ∈ {0} ∪ [L_j, U_j];  u_j(x) = v_j (1 − e^(−k_j x))" actions={<button className="btn btn-ghost" onClick={addProject}>+ Add project</button>} flush>
          <div className="max-h-[26rem] overflow-auto">
            <table className="tbl">
              <thead className="sticky top-0"><tr><th>#</th><th>Project name</th><th>Min L<sub>j</sub></th><th>Max U<sub>j</sub></th><th>Benefit v<sub>j</sub></th><th>Utility k<sub>j</sub></th><th /></tr></thead>
              <tbody>
                {problem.projects.map((p, j) => (
                  <tr key={j}>
                    <td className="text-ink-soft">{j + 1}</td>
                    <td><input className={`input ${p.name.trim() ? "" : "invalid"}`} value={p.name} aria-label={`Project ${j + 1} name`} onChange={(e) => edit((q) => { q.projects[j].name = e.target.value; return q; })} /></td>
                    <td><NumInput int min={1} className="w-20" aria-label={`L ${j + 1}`} value={p.L} onChange={(v) => edit((q) => { q.projects[j].L = v; return q; })} /></td>
                    <td><NumInput int min={1} className="w-20" aria-label={`U ${j + 1}`} value={p.U} invalid={p.L > p.U} onChange={(v) => edit((q) => { q.projects[j].U = v; return q; })} /></td>
                    <td><NumInput min={0} className="w-24" aria-label={`v ${j + 1}`} value={p.v} onChange={(v) => edit((q) => { q.projects[j].v = v; return q; })} /></td>
                    <td><NumInput min={0} step={0.01} className="w-24" aria-label={`k ${j + 1}`} value={p.k} onChange={(v) => edit((q) => { q.projects[j].k = v; return q; })} /></td>
                    <td><button className="text-[0.8rem] text-danger hover:underline" onClick={() => delProject(j)} disabled={problem.projects.length <= 1}>remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Resources" subtitle="Capacity R_i must be positive" actions={<button className="btn btn-ghost" onClick={addResource}>+ Add resource</button>} flush>
          <table className="tbl">
            <thead><tr><th>Resource</th><th>Capacity R<sub>i</sub></th><th /></tr></thead>
            <tbody>
              {problem.resources.map((r, i) => (
                <tr key={i}>
                  <td><input className={`input ${r.name.trim() ? "" : "invalid"}`} value={r.name} aria-label={`Resource ${i + 1} name`} onChange={(e) => edit((q) => { q.resources[i].name = e.target.value; return q; })} /></td>
                  <td><NumInput min={0} className="w-28" aria-label={`Capacity ${i + 1}`} value={r.capacity} onChange={(v) => edit((q) => { q.resources[i].capacity = v; return q; })} /></td>
                  <td><button className="text-[0.8rem] text-danger hover:underline" onClick={() => delResource(i)} disabled={problem.resources.length <= 1}>remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Resource consumption matrix a_ij" subtitle="Amount of resource i consumed by one work unit of project j (rows = projects, columns = resources)" className="mb-6" flush>
        <div className="max-h-[26rem] overflow-auto">
          <table className="tbl">
            <thead className="sticky top-0"><tr><th>Project</th>{problem.resources.map((r, i) => <th key={i} className="num">a<sub>{i + 1}j</sub> · {r.name}</th>)}</tr></thead>
            <tbody>
              {problem.projects.map((p, j) => (
                <tr key={j}>
                  <td>{p.name}</td>
                  {problem.resources.map((_, i) => (
                    <td key={i} className="num"><NumInput min={0} className="ml-auto w-24" aria-label={`a ${i + 1},${j + 1}`} value={problem.consumption[i][j]} invalid={!(problem.consumption[i][j] >= 0)}
                      onChange={(v) => edit((q) => { q.consumption[i][j] = v; return q; })} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Validation" subtitle="Rules: positive capacities · L ≤ U · integer allocations · non-negative consumption · a feasible start must exist">
        <div className="space-y-2">
          {errors.length === 0 && !serverErr && <Alert kind="ok">Client-side checks passed ({problem.projects.length} projects, {problem.resources.length} resources).</Alert>}
          {errors.map((e, i) => <Alert key={i} kind="error">{e}</Alert>)}
          {serverErr && <Alert kind="error" title="Server validation">{serverErr}</Alert>}
          {server?.errors.map((e, i) => <Alert key={i} kind="error">{e}</Alert>)}
          {server?.warnings.map((w, i) => <Alert key={i} kind="warn">{w}</Alert>)}
          {server && server.valid && (
            <Alert kind="info" title="Model diagnostics">
              Default penalty λ = 10 × max v<sub>j</sub> = <b>{fmt(server.default_lambda, 1)}</b>. Demand if every project ran at its minimum / maximum, as a share of capacity:{" "}
              {problem.resources.map((r, i) => `${r.name}: ${(server.min_demand_ratio[i] * 100).toFixed(0)}% / ${(server.max_demand_ratio[i] * 100).toFixed(0)}%`).join(" · ")}.{" "}
              Exact enumeration: {server.exact.allowed ? <b>allowed</b> : <b>not allowed</b>} (search space {sci(server.exact.search_space_log10, server.exact.search_space)}).
            </Alert>
          )}
        </div>
      </Panel>
    </>
  );
}
