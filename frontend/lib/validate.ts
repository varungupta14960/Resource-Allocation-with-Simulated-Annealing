import type { ProblemData } from "./types";

/** Instant client-side checks (the server repeats and extends them). */
export function validateProblem(p: ProblemData): string[] {
  const e: string[] = [];
  if (!p.projects.length) e.push("Add at least one project.");
  if (!p.resources.length) e.push("Add at least one resource.");
  p.projects.forEach((pr, j) => {
    const t = `Project ${j + 1} (${pr.name || "unnamed"})`;
    if (!pr.name.trim()) e.push(`Project ${j + 1}: name is required.`);
    if (!Number.isInteger(pr.L) || pr.L < 1) e.push(`${t}: minimum L must be an integer ≥ 1.`);
    if (!Number.isInteger(pr.U) || pr.U < 1) e.push(`${t}: maximum U must be an integer ≥ 1.`);
    if (Number.isInteger(pr.L) && Number.isInteger(pr.U) && pr.L > pr.U) e.push(`${t}: minimum L (${pr.L}) must be ≤ maximum U (${pr.U}).`);
    if (!(pr.v > 0)) e.push(`${t}: benefit v must be > 0.`);
    if (!(pr.k > 0)) e.push(`${t}: utility parameter k must be > 0.`);
  });
  p.resources.forEach((r, i) => {
    if (!r.name.trim()) e.push(`Resource ${i + 1}: name is required.`);
    if (!(r.capacity > 0)) e.push(`Resource ${i + 1} (${r.name}): capacity must be > 0 (negative or zero capacity is not allowed).`);
  });
  p.consumption.forEach((row, i) => row.forEach((a, j) => {
    if (!(a >= 0) || !Number.isFinite(a)) e.push(`a[${p.resources[i]?.name ?? i + 1}, ${p.projects[j]?.name ?? j + 1}] must be a number ≥ 0.`);
  }));
  return e;
}
