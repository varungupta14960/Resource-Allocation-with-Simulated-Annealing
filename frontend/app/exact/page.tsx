"use client";
import { useEffect, useMemo, useState } from "react";
import { AllocationTable } from "@/components/AllocationTable";
import { BarCard, C, METHOD_COLORS } from "@/components/charts";
import { Alert, Explain, Figure, FigureStrip, PageHeader, Panel, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms, sci } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { ValidateResult } from "@/lib/types";
import { validateProblem } from "@/lib/validate";

export default function ExactPage() {
  const { problem, params, results, setResult, datasets } = useStore();
  const [info, setInfo] = useState<ValidateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);
  useEffect(() => { if (problem && !errors.length) api.validate(problem).then(setInfo).catch(() => setInfo(null)); }, [problem, errors.length]);
  if (!problem) return <Spinner label="Loading dataset…" />;
  const allowed = info?.exact.allowed ?? false;
  const cmp = results.compare;
  async function run() {
    setBusy(true); setErr(null);
    try { const r = await api.compare(problem!, params, null, true); setResult("compare", r); setResult("sa", r.sa_run); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  const ex = cmp?.exact;
  const sa = cmp?.methods.find((m) => m.key === "sa");
  return (
    <>
      <PageHeader title="Exact Optimum" lead="Exhaustive enumeration with feasibility pruning, used only to validate SA on small instances.">
        <button className="btn btn-primary" onClick={run} disabled={busy || !allowed}>{busy ? "Enumerating…" : "Run exact search + validation"}</button>
      </PageHeader>
      <div className="mb-6"><Alert kind="warn" title="Warning">Exact enumeration is intended only for small problem instances because computational cost grows rapidly with problem size.</Alert></div>
      <Panel title="Instance size check" className="mb-6">
        {info ? (
          <>
            <p className="text-[0.9rem]">Raw search space ∏<sub>j</sub>(U<sub>j</sub> − L<sub>j</sub> + 2) = <b>{sci(info.exact.search_space_log10, info.exact.search_space)}</b> candidate allocations for “{problem.name}”. Safety limit: {info.exact.limit.toLocaleString()}.</p>
            <div className="mt-2">{allowed ? <Alert kind="ok">Exact search is allowed for this instance.</Alert> : <Alert kind="error" title="Exact search disabled">{info.exact.reason}</Alert>}</div>
          </>
        ) : <Spinner label="Checking…" />}
        <table className="tbl mt-4"><thead><tr><th>Built-in dataset</th><th className="num">n</th><th className="num">Search space</th><th>Exact search</th></tr></thead>
          <tbody>{datasets.map((d) => <tr key={d.id}><td>{d.id}</td><td className="num">{d.n_projects}</td><td className="num">{sci(d.search_space_log10, d.search_space)}</td><td>{d.exact_feasible ? <span className="badge badge-green">allowed</span> : <span className="badge badge-red">disabled</span>}</td></tr>)}</tbody></table>
        <p className="mt-2 text-[0.78rem] text-ink-soft">Each extra project multiplies the space by (U − L + 2): the growth is exponential in n, which is why SA is needed for realistic portfolios.</p>
      </Panel>
      {err && <div className="mb-4"><Alert kind="error">{err}</Alert></div>}
      {!allowed && info && !cmp?.exact && <Alert kind="info">{EXACT_UNAVAILABLE}</Alert>}
      {busy && <Spinner label="Enumerating on the backend…" />}
      {ex && sa && cmp && (
        <div className="space-y-6">
          <FigureStrip>
            <Figure label="Feasible solutions evaluated" value={ex.feasible_solutions.toLocaleString()} note={`${ex.nodes_visited.toLocaleString()} partial assignments visited`} />
            <Figure label="Exact optimal utility" value={fmt(ex.utility)} tone="good" />
            <Figure label="SA utility" value={fmt(sa.utility)} note={`seed ${cmp.seed}`} />
            <Figure label={<>Optimality gap</> as unknown as string} value={gapStr(sa.optimality_gap_pct)} note={sa.optimality_gap_pct === 0 ? "SA found the exact optimum" : "SA is below the optimum"} />
            <Figure label="Search space" value={ex.search_space.toLocaleString()} />
            <Figure label="Exact runtime" value={ms(ex.runtime_ms)} note={`SA: ${ms(sa.runtime_ms)}`} />
          </FigureStrip>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Exact optimal allocation"><AllocationTable problem={problem} result={cmp.methods.find((m) => m.key === "exact")!} /></Panel>
            <BarCard title="Utility vs the exact optimum" data={cmp.methods.map((m) => ({ name: m.method.split(" (")[0].replace(" Allocation", ""), key: m.key, utility: m.utility }))} xKey="name" bars={[{ key: "utility", name: "utility", color: C.green }]} colorBy={(r) => METHOD_COLORS[r.key as string]} zoom yLabel="utility" />
          </div>
          <Panel title={<>Baselines against the exact optimum <Explain topic="gap" /></>} flush>
            <table className="tbl"><thead><tr><th>Method</th><th className="num">Utility</th><th className="num">Optimality gap</th><th className="num">Runtime</th></tr></thead>
              <tbody>{cmp.methods.map((m) => <tr key={m.key} className={m.key === "exact" ? "best" : ""}><td>{m.method}</td><td className="num">{fmt(m.utility)}</td><td className="num">{gapStr(m.optimality_gap_pct)}</td><td className="num">{ms(m.runtime_ms)}</td></tr>)}</tbody></table>
          </Panel>
        </div>
      )}
      {cmp && !cmp.exact && allowed && <Alert kind="info">Press “Run exact search + validation” to enumerate this instance.</Alert>}
    </>
  );
}
