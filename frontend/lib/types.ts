export interface Project { name: string; L: number; U: number; v: number; k: number }
export interface Resource { name: string; capacity: number }
export interface ProblemData { name: string; projects: Project[]; resources: Resource[]; consumption: number[][] }

export interface SAParams {
  t0: number; alpha: number; t_min: number; chain_length: number;
  penalty_weight: number | null; seed: number; patience: number;
}

export interface MethodResult {
  key: string; method: string; allocation: number[]; utility: number; energy: number; feasible: boolean;
  usage: number[]; utilization: number[]; mean_utilization: number; n_violations: number; total_violation: number;
  runtime_ms: number; evaluations: number | null; optimality_gap_pct: number | null; note: string;
}
export interface SAStep {
  step: number; iteration: number; temperature: number; current_energy: number; current_utility: number;
  current_feasible: boolean; best_utility: number; best_energy: number; accept_rate: number;
  improving: number; uphill: number; rejected: number; last_status: string;
}
export interface SAStepLive extends SAStep { current_allocation: number[]; best_allocation: number[] }
export interface SAState { allocation: number[]; utility: number; energy: number; feasible: boolean }
export interface SAStats {
  iterations: number; levels: number; accepted: number; improving: number; uphill_accepted: number;
  rejected: number; noop_moves: number; infeasible_iterations: number; runtime_ms: number; stop_reason: string;
  best_found_iteration: number; min_energy_visited: number;
}
export interface SARun {
  seed: number; params: { t0: number; alpha: number; t_min: number; chain_length: number; penalty_weight: number; seed: number; patience: number };
  initial: SAState; final: SAState; best: MethodResult; history: SAStep[]; stats: SAStats; exact_utility: number | null;
}
export interface ExactStatus { allowed: boolean; search_space: string; search_space_log10: number; limit: number; reason: string | null }
export interface ExactInfo { allocation: number[]; utility: number; feasible_solutions: number; nodes_visited: number; search_space: number; runtime_ms: number }
export interface CompareResult {
  seed: number; lam: number; random_samples: number; methods: MethodResult[]; sa_run: SARun; exact: ExactInfo | null;
  exact_status: ExactStatus; best_method: string; best_methods_tied: string[]; messages: string[];
}
export interface Describe { n: number; mean: number; median: number; std: number; min: number; max: number; q1: number; q3: number }
export interface ExperimentRun {
  run: number; seed: number; sa_utility: number; sa_energy: number; sa_feasible: boolean; sa_runtime_ms: number;
  sa_iterations: number; sa_mean_utilization: number; sa_gap_pct: number | null; sa_best_found_iteration: number;
  random_utility: number; random_runtime_ms: number; random_gap_pct: number | null;
}
export interface ExperimentResult {
  n_runs: number; base_seed: number; seeds: number[]; lam: number;
  params: { t0: number; alpha: number; t_min: number; chain_length: number; penalty_weight: number };
  runs: ExperimentRun[];
  sa: { utility: Describe; runtime_ms: Describe; gap_pct: Describe | null; all_feasible: boolean; optimum_hits: number | null; iterations: number };
  random: { utility: Describe; runtime_ms: Describe; samples: number };
  equal: MethodResult; greedy: MethodResult;
  best_run: MethodResult & { seed: number; run: number }; worst_run: MethodResult & { seed: number; run: number };
  histogram: { lo: number; hi: number; sa: number; random: number }[];
  convergence: { iteration: number[]; temperature: number[]; mean: number[]; min: number[]; max: number[] };
  exact: ExactInfo | null; exact_status: ExactStatus; exact_utility: number | null;
}
export interface SensConfig {
  alpha: number; t0: number; runs: number; mean_utility: number; std_utility: number; best_utility: number;
  worst_utility: number; mean_runtime_ms: number; mean_iterations: number; mean_best_found_iteration: number;
  mean_gap_pct: number | null; optimum_hits: number | null; convergence: number[];
}
export interface SensitivityResult {
  seed: number; runs_per_config: number; alphas: number[]; t0s: number[]; progress: number[]; configs: SensConfig[];
  best_config: { alpha: number; t0: number; mean_utility: number; mean_runtime_ms: number; tied_on_utility: number; label: string };
  exact_utility: number | null; exact_status: ExactStatus; params: { t_min: number; chain_length: number };
}
export interface DatasetMeta {
  id: string; name: string; role: string; description: string; n_projects: number; n_resources: number;
  search_space: string; search_space_log10: number; exact_feasible: boolean;
}
export interface ValidateResult {
  valid: boolean; errors: string[]; warnings: string[]; default_lambda: number; exact: ExactStatus;
  min_demand_ratio: number[]; max_demand_ratio: number[];
}
export interface Results { sa?: SARun; compare?: CompareResult; experiment?: ExperimentResult; sensitivity?: SensitivityResult }
