import { api } from "./api";
import type { ProblemData, Results, SAParams } from "./types";

export type StageId = "load" | "sa" | "compare" | "experiment" | "sensitivity" | "summary";
export const STAGES: { id: StageId; label: string; detail: string }[] = [
  { id: "load", label: "Load dataset & validate", detail: "Fetch the dataset, check constraints and feasibility" },
  { id: "sa", label: "Run Simulated Annealing", detail: "Execute SA on the backend and record the convergence history" },
  { id: "compare", label: "Baselines + exact optimum", detail: "Equal, greedy, random-feasible, and exhaustive search when the instance is small" },
  { id: "experiment", label: "Independent runs", detail: "Repeat SA with different seeds and compute summary statistics" },
  { id: "sensitivity", label: "Parameter sensitivity", detail: "Run SA on the α × T₀ grid" },
  { id: "summary", label: "Generate analysis", detail: "Build the results summary from the computed values" },
];

export interface PipelineOptions {
  problem: ProblemData; params: SAParams; nRuns: number; sensRuns: number;
  onStage: (id: StageId, state: "running" | "done" | "error", info?: string) => void;
  onResult: <K extends keyof Results>(k: K, v: Results[K]) => void;
}

/** One reproducible pass through the whole methodology: everything is computed by the backend. */
export async function runPipeline(o: PipelineOptions): Promise<void> {
  const t = () => performance.now();
  let t0 = t();
  const stage = async <T,>(id: StageId, fn: () => Promise<T>, info?: (v: T) => string): Promise<T> => {
    o.onStage(id, "running");
    t0 = t();
    try {
      const v = await fn();
      o.onStage(id, "done", `${info ? info(v) + " · " : ""}${((t() - t0) / 1000).toFixed(2)} s`);
      return v;
    } catch (e) {
      o.onStage(id, "error", (e as Error).message);
      throw e;
    }
  };
  await stage("load", async () => api.validate(o.problem), (v) => (v.valid ? `${v.warnings.length} warning(s)` : "invalid"));
  const cmp = await stage("sa", () => api.compare(o.problem, o.params, null, true), (c) => `utility ${c.sa_run.best.utility.toFixed(2)}`);
  o.onResult("compare", cmp);
  o.onResult("sa", cmp.sa_run);
  o.onStage("compare", "done", `${cmp.methods.length} methods · exact ${cmp.exact ? "computed" : "not computed"}`);
  const exp = await stage("experiment", () => api.experiment(o.problem, o.params, o.nRuns, null, true),
    (e) => `${e.n_runs} runs, mean ${e.sa.utility.mean.toFixed(2)}`);
  o.onResult("experiment", exp);
  const sens = await stage("sensitivity", () => api.sensitivity(o.problem, o.params, [0.9, 0.95, 0.99], [10, 50, 100, 200], o.sensRuns),
    (s) => `${s.configs.length} configurations`);
  o.onResult("sensitivity", sens);
  o.onStage("summary", "done", "ready");
}
