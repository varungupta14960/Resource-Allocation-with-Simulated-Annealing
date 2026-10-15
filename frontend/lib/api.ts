import type { CompareResult, DatasetMeta, ExactInfo, ExactStatus, ExperimentResult, ProblemData, SAParams, SARun,
  SAStepLive, SensitivityResult, ValidateResult } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {}

function describeDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
      const msg = String(d?.msg ?? JSON.stringify(d)).replace(/^Value error, /, "");
      return loc ? `${loc}: ${msg}` : msg;
    }).join("; ");
  }
  return JSON.stringify(detail);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(`Cannot reach the backend at ${API_BASE}. Start it with:  uvicorn app.main:app --port 8000`);
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
    throw new ApiError(describeDetail(detail));
  }
  return res.json() as Promise<T>;
}

const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  datasets: () => request<DatasetMeta[]>("/api/datasets"),
  dataset: (id: string) => request<{ meta: DatasetMeta; problem: ProblemData }>(`/api/datasets/${id}`),
  generate: (n: number, m: number, seed: number) =>
    request<ProblemData>(`/api/datasets/generate?n_projects=${n}&n_resources=${m}&seed=${seed}`),
  validate: (problem: ProblemData) => post<ValidateResult>("/api/problem/validate", problem),
  compare: (problem: ProblemData, params: SAParams, random_samples: number | null, run_exact: boolean) =>
    post<CompareResult>("/api/compare", { problem, params, random_samples, run_exact }),
  exact: (problem: ProblemData) => post<{ status: ExactStatus; exact: ExactInfo }>("/api/exact", { problem }),
  experiment: (problem: ProblemData, params: SAParams, n_runs: number, random_samples: number | null, include_exact: boolean) =>
    post<ExperimentResult>("/api/experiments/run", { problem, params, n_runs, random_samples, include_exact }),
  sensitivity: (problem: ProblemData, params: SAParams, alphas: number[], t0s: number[], runs_per_config: number) =>
    post<SensitivityResult>("/api/sensitivity/run", { problem, params, alphas, t0s, runs_per_config, include_exact: true }),
  saRun: (problem: ProblemData, params: SAParams) => post<SARun>("/api/sa/run", { problem, params }),
};

export type StreamEvent =
  | { type: "start"; total_levels: number; lam: number; initial_allocation: number[]; initial_utility: number; initial_energy: number; seed: number }
  | ({ type: "step" } & SAStepLive)
  | { type: "result"; result: SARun }
  | { type: "error"; detail: string };

/** Reads the Server-Sent-Events stream produced by POST /api/sa/stream. */
export async function streamSA(problem: ProblemData, params: SAParams, delay_ms: number,
                               onEvent: (e: StreamEvent) => void, signal: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/sa/stream`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, params, delay_ms }), signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(`Cannot reach the backend at ${API_BASE}.`);
  }
  if (!res.ok || !res.body) {
    let detail: unknown = res.statusText;
    try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
    throw new ApiError(describeDetail(detail));
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (chunk.startsWith("data:")) onEvent(JSON.parse(chunk.slice(5).trim()) as StreamEvent);
    }
  }
}
