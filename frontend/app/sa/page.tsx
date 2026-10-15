"use client";
import { useMemo, useRef, useState } from "react";
import { AllocationTable, UsageChart } from "@/components/AllocationTable";
import { BarCard, C, LineCard } from "@/components/charts";
import { Alert, Explain, ExplainGrid, Figure, FigureStrip, InitialTestBadge, NumInput, PageHeader, Panel, Spinner } from "@/components/ui";
import { ApiError, streamSA } from "@/lib/api";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms } from "@/lib/format";
import { DEFAULT_PARAMS, useStore } from "@/lib/store";
import type { SAStep, SAStepLive } from "@/lib/types";
import { validateProblem } from "@/lib/validate";

type Status = "idle" | "running" | "done" | "stopped" | "error";

function levelsFor(t0: number, a: number, tmin: number): number {
  if (!(t0 > tmin) || !(a > 0 && a < 1) || !(tmin > 0)) return 0;
  return Math.ceil(Math.log(tmin / t0) / Math.log(a) - 1e-12);
}

export default function SAPage() {
  const { problem, params, setParams, results, setResult, lambda } = useStore();
  const [delay, setDelay] = useState(20);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ steps: SAStepLive[]; total: number; lam: number; initU?: number; initE?: number } | null>(null);
  const buf = useRef<SAStepLive[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  const problemErrors = useMemo(() => (problem ? validateProblem(problem) : []), [problem]);
  const paramErrors = useMemo(() => {
    const e: string[] = [];
    if (!(params.t0 > 0)) e.push("T₀ must be > 0.");
    if (!(params.t_min > 0)) e.push("T_min must be > 0.");
    if (params.t0 <= params.t_min) e.push("T₀ must be greater than T_min.");
    if (!(params.alpha > 0 && params.alpha < 1)) e.push("Cooling rate α must satisfy 0 < α < 1.");
    if (!Number.isInteger(params.chain_length) || params.chain_length < 1) e.push("Chain length must be an integer ≥ 1.");
    if (!Number.isInteger(params.seed) || params.seed < 0) e.push("Seed must be an integer ≥ 0.");
    if (params.penalty_weight !== null && !(params.penalty_weight > 0)) e.push("λ must be > 0 (or use the automatic value).");
    return e;
  }, [params]);
  const levels = levelsFor(params.t0, params.alpha, params.t_min);
  const running = status === "running";
  const blocked = !problem || problemErrors.length > 0 || paramErrors.length > 0;

  const flush = () => {
    const chunk = buf.current.splice(0);
    if (chunk.length) setLive((l) => (l ? { ...l, steps: [...l.steps, ...chunk] } : l));
  };

  async function run() {
    if (!problem || blocked) return;
    buf.current = [];
    setLive({ steps: [], total: levels, lam: lambda });
    setStatus("running"); setError(null);
    const c = new AbortController();
    ctrl.current = c;
    const timer = setInterval(flush, 90);
    try {
      await streamSA(problem, params, delay, (ev) => {
        if (ev.type === "start") setLive((l) => (l ? { ...l, total: ev.total_levels, lam: ev.lam, initU: ev.initial_utility, initE: ev.initial_energy } : l));
        else if (ev.type === "step") buf.current.push(ev);
        else if (ev.type === "result") setResult("sa", ev.result);
        else if (ev.type === "error") throw new ApiError(ev.detail);
      }, c.signal);
      setStatus("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") setStatus("stopped");
      else { setStatus("error"); setError((e as Error).message); }
    } finally {
      clearInterval(timer);
      flush();
    }
  }
  const stop = () => ctrl.current?.abort();
  const reset = () => { ctrl.current?.abort(); buf.current = []; setLive(null); setStatus("idle"); setError(null); setResult("sa", undefined); };

  const hist: SAStep[] = live ? live.steps : results.sa?.history ?? [];
  const last = hist[hist.length - 1] as SAStepLive | undefined;
  const sa = results.sa;
  const data = useMemo(() => hist.map((h) => ({
    iteration: h.iteration, current_energy: h.current_energy, best_energy: h.best_energy, current_utility: h.current_utility,
    best_utility: h.best_utility, temperature: h.temperature, accept_rate: +(h.accept_rate * 100).toFixed(2),
    improving: h.improving, uphill: h.uphill, rejected: h.rejected,
  })), [hist]);

  if (!problem) return <Spinner label="Loading dataset…" />;
  const set = <K extends keyof typeof params>(k: K, v: (typeof params)[K]) => setParams({ ...params, [k]: v });
  const totalLevels = live?.total || levels;
  const progress = totalLevels ? Math.min(100, ((last?.step ?? 0) / totalLevels) * 100) : 0;

  return (
    <>
      <PageHeader title="Simulated Annealing" lead="Run the real backend algorithm and watch it cool. Each update below is one temperature level (a chain of moves) streamed from the server.">
        <button className="btn btn-primary" onClick={run} disabled={running || blocked}>RUN SIMULATED ANNEALING</button>
        <button className="btn btn-danger" onClick={stop} disabled={!running}>STOP</button>
        <button className="btn btn-ghost" onClick={reset} disabled={status === "idle" && !sa}>RESET</button>
      </PageHeader>

      {(problemErrors.length > 0 || paramErrors.length > 0) && (
        <div className="mb-4 space-y-2">
          {problemErrors.length > 0 && <Alert kind="error" title="Problem is invalid">{problemErrors[0]} (fix it on the Problem Setup page)</Alert>}
          {paramErrors.map((e, i) => <Alert key={i} kind="error">{e}</Alert>)}
        </div>
      )}
      {error && <div className="mb-4"><Alert kind="error" title="Run failed">{error}</Alert></div>}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel title="Parameters" actions={<InitialTestBadge />} subtitle="Starting values only: not claimed to be optimal. Change them and compare.">
          <div className="space-y-3">
            <label className="block"><span className="label">Initial temperature T₀</span>
              <NumInput value={params.t0} min={0} disabled={running} onChange={(v) => set("t0", v)} /></label>
            <label className="block"><span className="label">Cooling rate α</span><Explain topic="cooling" />
              <NumInput value={params.alpha} step={0.01} min={0} max={1} disabled={running} onChange={(v) => set("alpha", v)} /></label>
            <label className="block"><span className="label">Minimum temperature T<sub>min</sub></span>
              <NumInput value={params.t_min} min={0} disabled={running} onChange={(v) => set("t_min", v)} /></label>
            <label className="block"><span className="label">Chain length (moves per temperature)</span>
              <NumInput int value={params.chain_length} min={1} disabled={running} onChange={(v) => set("chain_length", v)} /></label>
            <div>
              <span className="label">Penalty weight λ</span><Explain topic="penalty" />
              <label className="mb-1 flex items-center gap-2 text-[0.8rem]">
                <input type="checkbox" checked={params.penalty_weight === null} disabled={running}
                  onChange={(e) => set("penalty_weight", e.target.checked ? null : 10 * Math.max(...problem.projects.map((p) => p.v)))} />
                Automatic: 10 × max v<sub>j</sub> = {fmt(10 * Math.max(...problem.projects.map((p) => p.v)), 1)}
              </label>
              {params.penalty_weight !== null && <NumInput value={params.penalty_weight} min={0} disabled={running} onChange={(v) => set("penalty_weight", v)} />}
            </div>
            <label className="block"><span className="label">Random seed (reproducibility)</span>
              <NumInput int value={params.seed} min={0} disabled={running} onChange={(v) => set("seed", v)} /></label>
            <label className="block"><span className="label">Live pacing: pause per temperature level (ms)</span>
              <NumInput int value={delay} min={0} max={2000} disabled={running} onChange={(v) => setDelay(Number.isFinite(v) ? v : 0)} />
              <span className="text-[0.72rem] text-ink-soft">0 = full speed. Pacing is excluded from the reported SA runtime.</span></label>
            <div className="border-t border-rule pt-2 text-[0.78rem] text-ink-soft">
              Levels = ⌈ln(T<sub>min</sub>/T₀)/ln α⌉ = <b className="text-ink">{levels}</b>; iterations ≈ <b className="text-ink">{(levels * (params.chain_length || 0)).toLocaleString()}</b>
            </div>
            <button className="btn btn-ghost w-full" disabled={running} onClick={() => setParams({ ...DEFAULT_PARAMS, seed: params.seed })}>Restore initial test values</button>
          </div>
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel title={<span className="flex items-center gap-3">Live execution
            {status === "running" && <Spinner label="running" />}
            {status === "done" && <span className="badge badge-green">completed</span>}
            {status === "stopped" && <span className="badge badge-gold">stopped by user</span>}
            {status === "idle" && sa && <span className="badge badge-grey">showing last result</span>}</span>}
            subtitle={last ? `Level ${last.step} of ${totalLevels} · seed ${params.seed}` : "Press RUN SIMULATED ANNEALING"}>
            <div className="mb-3 h-2 w-full bg-mint-200" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 bg-forest-700 transition-[width]" style={{ width: `${status === "done" ? 100 : progress}%` }} />
            </div>
            <FigureStrip cols={4}>
              <Figure label="Current temperature T" value={last ? fmt(last.temperature, 4) : "—"} />
              <Figure label="Iteration" value={last ? last.iteration.toLocaleString() : "—"} note={totalLevels ? `of ≈ ${(totalLevels * params.chain_length).toLocaleString()}` : undefined} />
              <Figure label="Current utility" value={last ? fmt(last.current_utility) : "—"} note={last ? (last.current_feasible ? "feasible state" : "infeasible (penalised)") : undefined} tone={last && !last.current_feasible ? "warn" : "default"} />
              <Figure label="Current energy" value={last ? fmt(last.current_energy) : "—"} />
              <Figure label="Best utility" value={last ? fmt(last.best_utility) : "—"} tone="good" />
              <Figure label="Best energy" value={last ? fmt(last.best_energy) : "—"} tone="good" />
              <Figure label="Acceptance (last chain)" value={last ? `${(last.accept_rate * 100).toFixed(0)}%` : "—"} note={last ? `${last.improving} improved · ${last.uphill} worse accepted · ${last.rejected} rejected` : undefined} />
              <Figure label="Last move status" value={<span className="text-[1.05rem]">{last?.last_status ?? "—"}</span>} />
            </FigureStrip>
            {last?.current_allocation && (
              <div className="mt-3">
                <div className="label mb-1">Current solution x (units per project)</div>
                <div className="flex max-h-24 flex-wrap gap-1 overflow-auto">
                  {last.current_allocation.map((v, j) => (
                    <span key={j} title={problem.projects[j].name} className={`inline-flex min-w-[2.6rem] justify-between gap-1 border px-1.5 py-0.5 text-[0.75rem] tabular-nums ${v ? "border-forest-700 bg-mint-100" : "border-rule text-ink-soft"}`}>
                      <span className="text-ink-soft">{j + 1}</span><b>{v}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {data.length > 1 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <LineCard title={<>Energy vs iteration <Explain topic="energy" /></>} data={data} xKey="iteration" xLabel="iteration" yLabel="E(x)"
                series={[{ key: "current_energy", name: "Current energy", color: C.mint, width: 1.4 }, { key: "best_energy", name: "Best feasible energy", color: C.dark, width: 2.2 }]} xFmt={(v) => v.toLocaleString()} />
              <LineCard title="Utility vs iteration" data={data} xKey="iteration" xLabel="iteration" yLabel="U(x)"
                series={[{ key: "current_utility", name: "Current utility", color: C.mint, width: 1.4 }, { key: "best_utility", name: "Best feasible utility", color: C.dark, width: 2.2 }]} xFmt={(v) => v.toLocaleString()} />
              <LineCard title={<>Temperature vs iteration <Explain topic="cooling" /></>} data={data} xKey="iteration" xLabel="iteration" yLabel="T (log scale)" logY
                series={[{ key: "temperature", name: "Temperature", color: C.gold, width: 2.2 }]} xFmt={(v) => v.toLocaleString()} />
              <LineCard title={<>Acceptance rate per temperature level <Explain topic="acceptance" /></>} data={data} xKey="iteration" xLabel="iteration" yLabel="accepted moves (%)" yDomain={[0, 100]}
                series={[{ key: "accept_rate", name: "Acceptance rate (%)", color: C.green, area: true, width: 2 }]} xFmt={(v) => v.toLocaleString()} />
              <div className="xl:col-span-2">
                <BarCard title="Move outcomes per temperature level" data={data.map((d, i) => ({ level: i + 1, improving: d.improving, uphill: d.uphill, rejected: d.rejected }))} xKey="level"
                  bars={[{ key: "improving", name: "Improved (ΔE ≤ 0)", color: C.dark }, { key: "uphill", name: "Worse move accepted", color: C.gold }, { key: "rejected", name: "Rejected", color: "#c9d6cf" }]} stacked height={220}
                  note="Early (hot) levels accept many worse moves; late (cold) levels reject nearly everything that is worse, so the search refines." />
              </div>
            </div>
          ) : (
            <Panel><p className="text-[0.9rem] text-ink-soft">Charts appear here as soon as the first temperature level arrives from the backend.</p></Panel>
          )}
        </div>
      </div>

      {sa && (
        <div className="mt-8 space-y-6">
          <h2 className="border-b-2 border-gold-400 pb-1 text-xl font-bold">BEST FEASIBLE ALLOCATION</h2>
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel title="Allocation found by SA" subtitle={`seed ${sa.seed} · ${sa.best.feasible ? "all constraints satisfied" : "INFEASIBLE"}`}>
              <AllocationTable problem={problem} result={sa.best} />
            </Panel>
            <UsageChart problem={problem} result={sa.best} />
          </div>
          <Panel title="Run statistics" subtitle="All values measured during this execution">
            <div className="grid gap-6 md:grid-cols-2">
              <table className="tbl">
                <thead><tr><th>Quantity</th><th className="num">Energy</th><th className="num">Utility</th></tr></thead>
                <tbody>
                  <tr><td>Initial solution</td><td className="num">{fmt(sa.initial.energy)}</td><td className="num">{fmt(sa.initial.utility)}</td></tr>
                  <tr><td>Final (current state at stop)</td><td className="num">{fmt(sa.final.energy)}</td><td className="num">{fmt(sa.final.utility)}</td></tr>
                  <tr className="best"><td>Best feasible</td><td className="num">{fmt(sa.best.energy)}</td><td className="num">{fmt(sa.best.utility)}</td></tr>
                  <tr><td>Lowest energy of any visited state</td><td className="num">{fmt(sa.stats.min_energy_visited)}</td><td className="num">—</td></tr>
                </tbody>
              </table>
              <table className="tbl">
                <tbody>
                  <tr><td>Iterations (energy evaluations)</td><td className="num">{sa.stats.iterations.toLocaleString()}</td></tr>
                  <tr><td>Accepted: improving / worse</td><td className="num">{sa.stats.improving.toLocaleString()} / {sa.stats.uphill_accepted.toLocaleString()}</td></tr>
                  <tr><td>Rejected</td><td className="num">{sa.stats.rejected.toLocaleString()} ({((sa.stats.rejected / sa.stats.iterations) * 100).toFixed(1)}%)</td></tr>
                  <tr><td>Iterations spent in infeasible states</td><td className="num">{sa.stats.infeasible_iterations.toLocaleString()}</td></tr>
                  <tr><td>Best found at iteration</td><td className="num">{sa.stats.best_found_iteration.toLocaleString()}</td></tr>
                  <tr><td>Runtime (compute only)</td><td className="num">{ms(sa.stats.runtime_ms)}</td></tr>
                  <tr><td>Stop reason</td><td className="num">{sa.stats.stop_reason === "t_min" ? "T ≤ T_min" : sa.stats.stop_reason}</td></tr>
                  <tr><td>Optimality gap <Explain topic="gap" /></td><td className="num">{sa.exact_utility !== null ? `${gapStr(sa.best.optimality_gap_pct)} (exact ${fmt(sa.exact_utility)})` : EXACT_UNAVAILABLE}</td></tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <Panel title="How the algorithm decides" subtitle="Hover the ? icons anywhere in the app for the same explanations" className="mt-8">
        <ExplainGrid topics={["deltaE", "acceptance", "energy", "penalty"]} />
      </Panel>
    </>
  );
}
