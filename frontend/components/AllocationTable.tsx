"use client";
import { fmt } from "@/lib/format";
import type { MethodResult, ProblemData } from "@/lib/types";

export function AllocationTable({ problem, result, maxHeight = "28rem" }: { problem: ProblemData; result: Pick<MethodResult, "allocation" | "usage" | "utilization" | "utility" | "feasible"> ; maxHeight?: string }) {
  const x = result.allocation;
  const uj = (j: number) => (x[j] === 0 ? 0 : problem.projects[j].v * (1 - Math.exp(-problem.projects[j].k * x[j])));
  return (
    <div className="overflow-auto border border-rule" style={{ maxHeight }}>
      <table className="tbl">
        <thead className="sticky top-0">
          <tr>
            <th>Project</th><th className="num">x<sub>j</sub> (units)</th><th className="num">Range</th><th className="num">u<sub>j</sub>(x<sub>j</sub>)</th>
            {problem.resources.map((r) => <th key={r.name} className="num">{r.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {problem.projects.map((p, j) => (
            <tr key={j} className={x[j] === 0 ? "text-ink-soft" : ""}>
              <td>{p.name}</td>
              <td className="num font-semibold">{x[j] === 0 ? <span className="badge badge-grey">not funded</span> : x[j]}</td>
              <td className="num text-ink-soft">0 | {p.L}–{p.U}</td>
              <td className="num">{fmt(uj(j))}</td>
              {problem.resources.map((_, i) => <td key={i} className="num">{x[j] === 0 ? "—" : fmt(problem.consumption[i][j] * x[j], 1)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total"><td>Total / usage</td><td className="num">{x.reduce((a, b) => a + b, 0)}</td><td /><td className="num">{fmt(result.utility)}</td>
            {result.usage.map((u, i) => <td key={i} className="num">{fmt(u, 1)}</td>)}</tr>
          <tr className="total"><td>Capacity R<sub>i</sub></td><td /><td /><td />{problem.resources.map((r) => <td key={r.name} className="num">{fmt(r.capacity, 1)}</td>)}</tr>
          <tr className="total"><td>Utilization</td><td /><td /><td className="num">{result.feasible ? <span className="badge badge-green">feasible</span> : <span className="badge badge-red">infeasible</span>}</td>
            {result.utilization.map((u, i) => <td key={i} className="num">{(u * 100).toFixed(1)}%</td>)}</tr>
        </tfoot>
      </table>
    </div>
  );
}

import { BarCard, C } from "./charts";

export function UsageChart({ problem, result, title = "Resource usage vs capacity" }: { problem: ProblemData; result: Pick<MethodResult, "usage" | "utilization">; title?: string }) {
  const data = problem.resources.map((r, i) => ({ name: r.name, pct: +(result.utilization[i] * 100).toFixed(2), usage: result.usage[i], cap: r.capacity }));
  return (
    <BarCard title={title} data={data} xKey="name" bars={[{ key: "pct", name: "Usage (% of capacity)", color: C.green }]} yLabel="% of capacity"
      colorBy={(r) => ((r.pct as number) > 100.0001 ? C.red : C.green)} refY={{ y: 100, label: "capacity = 100%" }} yFmt={(v) => `${v.toFixed(0)}%`} height={240}
      note={data.map((d) => `${d.name}: ${fmt(d.usage, 1)} of ${fmt(d.cap, 1)}`).join(" · ")} />
  );
}
