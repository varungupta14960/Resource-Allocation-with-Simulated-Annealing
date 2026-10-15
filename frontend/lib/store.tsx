"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { DatasetMeta, ProblemData, Results, SAParams } from "./types";

export const DEFAULT_PARAMS: SAParams = { t0: 50, alpha: 0.95, t_min: 0.01, chain_length: 100, penalty_weight: null, seed: 42, patience: 0 };

interface Store {
  problem: ProblemData | null;
  datasetId: string | null;           // null = custom / edited
  datasets: DatasetMeta[];
  params: SAParams;
  results: Results;
  online: boolean | null;
  setProblem: (p: ProblemData, datasetId?: string | null) => void;
  setParams: (p: SAParams) => void;
  setResult: <K extends keyof Results>(k: K, v: Results[K]) => void;
  clearResults: () => void;
  loadDataset: (id: string) => Promise<ProblemData>;
  lambda: number;
}

const Ctx = createContext<Store | null>(null);
const LS = "pbl13-state-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [problem, setProblemState] = useState<ProblemData | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [params, setParamsState] = useState<SAParams>(DEFAULT_PARAMS);
  const [results, setResults] = useState<Results>({});
  const [online, setOnline] = useState<boolean | null>(null);

  const loadDataset = useCallback(async (id: string) => {
    const d = await api.dataset(id);
    setProblemState(d.problem);
    setDatasetId(id);
    setResults({});
    return d.problem;
  }, []);

  useEffect(() => {
    let saved: { problem?: ProblemData; datasetId?: string | null; params?: SAParams } = {};
    try { saved = JSON.parse(localStorage.getItem(LS) ?? "{}"); } catch { /* ignore */ }
    if (saved.params) setParamsState({ ...DEFAULT_PARAMS, ...saved.params });
    if (saved.problem) { setProblemState(saved.problem); setDatasetId(saved.datasetId ?? null); }
    api.health().then(() => setOnline(true)).catch(() => setOnline(false));
    api.datasets().then(setDatasets).catch(() => undefined);
    if (!saved.problem) loadDataset("small").catch(() => undefined);
  }, [loadDataset]);

  useEffect(() => {
    if (problem) localStorage.setItem(LS, JSON.stringify({ problem, datasetId, params }));
  }, [problem, datasetId, params]);

  const value = useMemo<Store>(() => ({
    problem, datasetId, datasets, params, results, online,
    setProblem: (p, id = null) => { setProblemState(p); setDatasetId(id); setResults({}); },
    setParams: setParamsState,
    setResult: (k, v) => setResults((r) => ({ ...r, [k]: v })),
    clearResults: () => setResults({}),
    loadDataset,
    lambda: params.penalty_weight ?? (problem ? 10 * Math.max(...problem.projects.map((p) => p.v)) : 0),
  }), [problem, datasetId, datasets, params, results, online, loadDataset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}
