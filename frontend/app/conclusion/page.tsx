"use client";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { EXACT_UNAVAILABLE, fmt, gapStr } from "@/lib/format";
import { useStore } from "@/lib/store";

const FUTURE = [
  ["Adaptive cooling schedules", "Adjust α or T from the observed acceptance rate instead of using a fixed geometric schedule."],
  ["Hybrid SA + local search", "Polish the best SA state with a deterministic hill-climb over single-unit moves."],
  ["Larger-scale optimization", "Hundreds of projects, tighter incremental evaluation and compiled kernels."],
  ["Parallel SA", "Independent chains on multiple cores, or parallel tempering with replica exchange."],
  ["Multi-objective optimization", "Trade utility against risk, cost or fairness and report a Pareto front."],
  ["Dynamic resource availability", "Re-optimise as capacities change over time, warm-starting from the previous plan."],
  ["Real-world project portfolio datasets", "Replace the documented synthetic parameters with organisational data."],
  ["More advanced metaheuristics", "Genetic algorithms, tabu search, late acceptance and adaptive penalty (rising λ as T falls)."],
];

export default function ConclusionPage() {
  const { problem, results, params } = useStore();
  const cmp = results.compare, exp = results.experiment, sens = results.sensitivity;
  const sa = cmp?.methods.find((m) => m.key === "sa") ?? results.sa?.best;
  const others = cmp?.methods.filter((m) => m.key !== "sa" && m.key !== "exact") ?? [];
  const rel = (m: { utility: number; method: string }) => {
    const d = (sa?.utility ?? 0) - m.utility;
    return Math.abs(d) < 1e-6 ? `tied with ${m.method}` : d > 0 ? `${((d / m.utility) * 100).toFixed(2)}% above ${m.method}` : `${((-d / m.utility) * 100).toFixed(2)}% below ${m.method}`;
  };
  return (
    <>
      <PageHeader title="Conclusion & Future Scope" lead="The conclusion is assembled from the experiments you ran in this session; sections without data say so instead of guessing." />
      <div className="space-y-6">
        <Panel title="What was implemented">
          <ul className="list-disc space-y-1 pl-5 text-[0.92rem]">
            <li>The integer, multi-resource allocation model with viability thresholds, diminishing-returns utility and penalty-based energy E(x).</li>
            <li>Simulated Annealing in Python with a feasibility-aware neighbourhood (transfer / adjust / toggle with snapping), geometric cooling and best-feasible tracking, driven by explicit random seeds.</li>
            <li>Equal, greedy and random-feasible baselines, and exhaustive enumeration with feasibility pruning for small instances.</li>
            <li>A 30-run experiment runner, an α × T₀ sensitivity grid, FastAPI endpoints, and 50 automated unit/API tests.</li>
          </ul>
        </Panel>
        <Panel title="What the experiments showed" subtitle={problem ? `Dataset: ${problem.name} · seed ${params.seed}` : undefined}>
          {!sa ? <p className="text-ink-soft">No results yet. <Link className="underline" href="/demo?auto=1">Run the demonstration</Link> to populate this section.</p> : (
            <div className="space-y-3 text-[0.93rem] leading-relaxed">
              <p><b>Constraints.</b> {sa.feasible ? `SA's reported allocation satisfies every resource constraint (${sa.n_violations} violations; mean utilization ${(sa.mean_utilization * 100).toFixed(1)}%).` : "SA's reported allocation violates a constraint on this run."}{exp && ` Across ${exp.n_runs} runs, ${exp.sa.all_feasible ? "all" : "not all"} SA results were feasible.`}</p>
              {cmp && <p><b>Against baselines.</b> On this run SA reached utility {fmt(sa.utility)}: {others.map(rel).join("; ")}.</p>}
              {exp && <p><b>Repeatability.</b> Over {exp.n_runs} seeds, SA's mean utility was {fmt(exp.sa.utility.mean)} (std {fmt(exp.sa.utility.std, 3)}, range {fmt(exp.sa.utility.min)}–{fmt(exp.sa.utility.max)}), versus {fmt(exp.random.utility.mean)} for the random-feasible baseline with an equal evaluation budget, {fmt(exp.greedy.utility)} for greedy and {fmt(exp.equal.utility)} for equal allocation.</p>}
              <p><b>Closeness to the optimum.</b> {cmp?.exact ? `Exhaustive search over ${cmp.exact.feasible_solutions.toLocaleString()} feasible allocations gives ${fmt(cmp.exact.utility)}; SA's gap is ${gapStr(sa.optimality_gap_pct)}${exp?.sa.optimum_hits != null ? ` and SA hit the optimum in ${exp.sa.optimum_hits} of ${exp.n_runs} runs` : ""}.` : EXACT_UNAVAILABLE}</p>
              {sens && <p><b>Parameter sensitivity.</b> Best observed configuration for this experiment: α={sens.best_config.alpha}, T₀={sens.best_config.t0}{sens.best_config.tied_on_utility > 1 ? ` (${sens.best_config.tied_on_utility} configurations tied on mean utility)` : ""}. This is an observation on this dataset, not a general optimum.</p>}
              <p className="text-[0.8rem] text-ink-soft">Limitations: SA offers no finite-time optimality guarantee; the data are documented synthetic parameters, not organisational records; results on other instances may differ, including instances where a baseline wins.</p>
            </div>
          )}
        </Panel>
        <Panel title="Future scope">
          <div className="grid gap-3 md:grid-cols-2">
            {FUTURE.map(([t, d]) => <div key={t} className="border-l-4 border-gold-400 bg-mint-50 p-3"><div className="font-serif font-bold text-forest-900">{t}</div><p className="text-[0.85rem] text-ink-soft">{d}</p></div>)}
          </div>
        </Panel>
      </div>
    </>
  );
}
