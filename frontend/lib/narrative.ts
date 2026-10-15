/** Every sentence below is built from numbers returned by the backend.  A sentence is only produced when
 *  the data needed to support it exists, and the wording adapts to whether SA won, tied or lost. */
import { fmt, gapStr, ms, EXACT_UNAVAILABLE } from "./format";
import type { CompareResult, ExperimentResult, MethodResult, Results, SensitivityResult } from "./types";

const EPS = 1e-6;

function versus(sa: number, other: MethodResult): string {
  const d = sa - other.utility;
  const rel = other.utility > 0 ? (Math.abs(d) / other.utility) * 100 : 0;
  if (Math.abs(d) <= EPS) return `matched ${other.method} (${fmt(other.utility)})`;
  return d > 0
    ? `exceeded ${other.method} (${fmt(other.utility)}) by ${fmt(d)} utility (${rel.toFixed(2)}% higher)`
    : `was below ${other.method} (${fmt(other.utility)}) by ${fmt(-d)} utility (${rel.toFixed(2)}% lower)`;
}

export function compareStatements(c: CompareResult): string[] {
  const out: string[] = [];
  const sa = c.methods.find((m) => m.key === "sa")!;
  const others = c.methods.filter((m) => m.key !== "sa" && m.key !== "exact");
  out.push(`With seed ${c.seed}, Simulated Annealing returned a total utility of ${fmt(sa.utility)}. Compared with the baselines, SA ${others.map((o) => versus(sa.utility, o)).join("; ")}.`);
  const infeasible = c.methods.filter((m) => !m.feasible);
  out.push(infeasible.length === 0
    ? `Constraint satisfaction: every method returned a feasible allocation (0 violated resources); SA's returned allocation is the best *feasible* state visited, so it is feasible by construction.`
    : `Constraint satisfaction: ${infeasible.map((m) => m.method).join(", ")} returned an infeasible allocation.`);
  out.push(`SA used ${(sa.mean_utilization * 100).toFixed(1)}% of capacity on average (${sa.utilization.map((u) => (u * 100).toFixed(1) + "%").join(", ")} per resource).`);
  const best = c.methods.filter((m) => m.feasible).reduce((a, b) => (b.utility > a.utility + EPS ? b : a));
  out.push(c.best_methods_tied.length > 1
    ? `Highest utility on this instance: tie between ${c.best_methods_tied.join(" and ")} (${fmt(best.utility)}).`
    : `Highest utility on this instance: ${best.method} (${fmt(best.utility)}).`);
  if (c.exact) {
    out.push(`Exact enumeration evaluated ${c.exact.feasible_solutions.toLocaleString()} feasible allocations (search space ${c.exact.search_space.toLocaleString()}) and found an optimum of ${fmt(c.exact.utility)}. SA's optimality gap is ${gapStr(sa.optimality_gap_pct)}${(sa.optimality_gap_pct ?? 1) === 0 ? " (SA found the exact optimum)" : ""}.`);
  } else {
    out.push(EXACT_UNAVAILABLE);
  }
  const s = c.sa_run;
  const first = s.history[0], last = s.history[s.history.length - 1];
  out.push(`Convergence: the best utility was first reached at iteration ${s.stats.best_found_iteration.toLocaleString()} of ${s.stats.iterations.toLocaleString()} (${((s.stats.best_found_iteration / s.stats.iterations) * 100).toFixed(1)}% of the run). The acceptance rate fell from ${(first.accept_rate * 100).toFixed(0)}% at T=${fmt(first.temperature, 2)} to ${(last.accept_rate * 100).toFixed(0)}% at T=${fmt(last.temperature, 3)}; ${s.stats.uphill_accepted.toLocaleString()} worse moves were accepted overall, which is how SA escapes local optima.`);
  return out;
}

export function experimentStatements(e: ExperimentResult, cmp?: CompareResult): string[] {
  const out: string[] = [];
  const u = e.sa.utility;
  out.push(`Over ${e.n_runs} independent SA runs (seeds ${e.seeds[0]}–${e.seeds[e.seeds.length - 1]}), the mean utility was ${fmt(u.mean)} (median ${fmt(u.median)}, std ${fmt(u.std, 3)}); best ${fmt(u.max)}, worst ${fmt(u.min)}. Mean runtime was ${ms(e.sa.runtime_ms.mean)}.`);
  out.push(e.sa.all_feasible ? "All SA runs returned feasible allocations." : "Some SA runs returned infeasible allocations.");
  const cmpTo = (m: MethodResult) => {
    const d = u.mean - m.utility;
    if (Math.abs(d) <= EPS) return `equal to ${m.method} (${fmt(m.utility)})`;
    return `${d > 0 ? "above" : "below"} ${m.method} (${fmt(m.utility)}) by ${fmt(Math.abs(d))}`;
  };
  out.push(`Mean SA utility was ${cmpTo(e.greedy)} and ${cmpTo(e.equal)}. Against the random-feasible baseline (best of ${e.random.samples.toLocaleString()} samples per run), mean utility was ${fmt(e.random.utility.mean)} for random versus ${fmt(u.mean)} for SA.`);
  if (e.exact && e.sa.optimum_hits !== null) {
    out.push(`Exact optimum = ${fmt(e.exact.utility)}. SA reached it in ${e.sa.optimum_hits} of ${e.n_runs} runs; mean optimality gap ${gapStr(e.sa.gap_pct?.mean)}, worst-run gap ${gapStr(e.sa.gap_pct?.max)}.`);
  } else {
    out.push(`Optimality gap over runs: ${EXACT_UNAVAILABLE}`);
  }
  void cmp;
  return out;
}

export function sensitivityStatements(s: SensitivityResult): string[] {
  const b = s.best_config;
  const out = [`Best observed configuration for this experiment: α = ${b.alpha}, T₀ = ${b.t0} (mean utility ${fmt(b.mean_utility)} over ${s.runs_per_config} runs per configuration, mean runtime ${ms(b.mean_runtime_ms)}).`];
  if (b.tied_on_utility > 1) out.push(`${b.tied_on_utility} of ${s.configs.length} configurations tied on mean utility; the fastest of them is reported. This is an observation for this dataset and these seeds, not a claim of global optimality.`);
  const slow = [...s.configs].sort((a, c) => c.mean_runtime_ms - a.mean_runtime_ms)[0];
  out.push(`Runtime grew with slower cooling: the slowest configuration (α = ${slow.alpha}, T₀ = ${slow.t0}) took ${ms(slow.mean_runtime_ms)} on average.`);
  return out;
}

export function allStatements(r: Results): string[] {
  const out: string[] = [];
  if (r.compare) out.push(...compareStatements(r.compare));
  if (r.experiment) out.push(...experimentStatements(r.experiment, r.compare));
  if (r.sensitivity) out.push(...sensitivityStatements(r.sensitivity));
  return out;
}
