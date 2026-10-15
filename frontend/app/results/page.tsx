"use client";
import Link from "next/link";
import { AllocationTable, UsageChart } from "@/components/AllocationTable";
import { BarCard, BoxPlot, C, LineCard, METHOD_COLORS } from "@/components/charts";
import { Figure, FigureStrip, NeedsData, PageHeader, Panel, Spinner } from "@/components/ui";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms } from "@/lib/format";
import { allStatements } from "@/lib/narrative";
import { useStore } from "@/lib/store";

export default function ResultsPage() {
  const { problem, results, params } = useStore();
  if (!problem) return <Spinner label="Loading…" />;
  const { compare: cmp, experiment: exp, sensitivity: sens } = results;
  const sa = cmp?.sa_run ?? results.sa;
  const stmts = allStatements(results);
  const best = sa?.best;
  return (
    <>
      <PageHeader title="Results & Analysis" lead="Everything on this page is computed by the backend for the current dataset; the prose is generated only from those numbers.">
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / Save as PDF</button>
      </PageHeader>
      {!sa ? (
        <NeedsData what="No results yet. Run the Professor Demo (all stages) or run SA and the comparison individually." href="/demo?auto=1" cta="Run demonstration" />
      ) : (
        <div className="space-y-6">
          <p className="text-[0.82rem] text-ink-soft">Dataset: <b>{problem.name}</b> · seed {sa.seed} · T₀={sa.params.t0}, α={sa.params.alpha}, T<sub>min</sub>={sa.params.t_min}, chain={sa.params.chain_length}, λ={fmt(sa.params.penalty_weight, 1)} <span className="badge badge-gold ml-1">Initial Test Values unless changed</span></p>
          <FigureStrip>
            <Figure label="SA utility" value={fmt(best!.utility)} tone="good" />
            <Figure label="Resource utilization" value={`${(best!.mean_utilization * 100).toFixed(1)}%`} />
            <Figure label="Runtime" value={ms(best!.runtime_ms)} />
            <Figure label="Constraints" value={best!.feasible ? "satisfied" : "VIOLATED"} tone={best!.feasible ? "good" : "warn"} note={`${best!.n_violations} violated resources`} />
            <Figure label="Optimality gap" value={gapStr(best!.optimality_gap_pct)} note={best!.optimality_gap_pct === null ? EXACT_UNAVAILABLE : undefined} />
            <Figure label="Best found at" value={`${((sa.stats.best_found_iteration / sa.stats.iterations) * 100).toFixed(0)}%`} note={`iteration ${sa.stats.best_found_iteration.toLocaleString()}`} />
          </FigureStrip>

          <Panel title="Automatically generated summary" subtitle="Each statement is derived from executed algorithms; if SA loses on this dataset, it says so.">
            {stmts.length ? <ul className="list-disc space-y-2 pl-5 text-[0.93rem] leading-relaxed">{stmts.map((s, i) => <li key={i}>{s}</li>)}</ul>
              : <p className="text-ink-soft">Run the baseline comparison to generate statements. <Link className="underline" href="/compare">Open comparison</Link></p>}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <Panel title="Best allocation (SA)"><AllocationTable problem={problem} result={best!} /></Panel>
            <UsageChart problem={problem} result={best!} title="Resource usage vs capacity" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <LineCard title="Convergence: best utility vs iteration" xKey="iteration" xLabel="iteration" yLabel="utility" xFmt={(v) => v.toLocaleString()}
              data={sa.history.map((h) => ({ iteration: h.iteration, best: h.best_utility, current: h.current_utility }))}
              series={[{ key: "current", name: "current", color: C.mint, width: 1.3 }, { key: "best", name: "best feasible", color: C.dark, width: 2.2 }]} />
            <LineCard title="Acceptance rate vs iteration" xKey="iteration" xLabel="iteration" yLabel="%" yDomain={[0, 100]} xFmt={(v) => v.toLocaleString()}
              data={sa.history.map((h) => ({ iteration: h.iteration, rate: h.accept_rate * 100 }))} series={[{ key: "rate", name: "acceptance (%)", color: C.green, area: true }]} />
            {cmp && <BarCard title="Method utility" data={cmp.methods.map((m) => ({ name: m.method.split(" (")[0].replace(" Allocation", ""), key: m.key, utility: m.utility }))} xKey="name" bars={[{ key: "utility", name: "utility", color: C.green }]} colorBy={(r) => METHOD_COLORS[r.key as string]} zoom yLabel="utility" />}
            {cmp?.exact && <BarCard title="Optimality gap by method" data={cmp.methods.filter((m) => m.key !== "exact").map((m) => ({ name: m.method.split(" (")[0].replace(" Allocation", ""), key: m.key, gap: m.optimality_gap_pct ?? 0 }))} xKey="name" bars={[{ key: "gap", name: "gap %", color: C.red }]} colorBy={(r) => METHOD_COLORS[r.key as string]} yLabel="%" />}
            {exp && <BoxPlot title={`Utility over ${exp.n_runs} runs`} items={[{ label: "SA", color: C.dark, ...exp.sa.utility }, { label: "Random", color: C.gold, ...exp.random.utility }]}
              markers={[{ label: "Greedy", value: exp.greedy.utility, color: C.mid }, { label: "Equal", value: exp.equal.utility, color: C.grey }, ...(exp.exact ? [{ label: "Exact", value: exp.exact.utility, color: C.purple }] : [])]} />}
            {sens && <BarCard title="Mean utility by (α, T₀) configuration" data={sens.configs.map((c) => ({ name: `${c.alpha}/${c.t0}`, u: c.mean_utility }))} xKey="name" bars={[{ key: "u", name: "mean utility", color: C.green }]} zoom yLabel="utility" />}
          </div>

          {cmp && (
            <Panel title="Comparison table" flush>
              <table className="tbl"><thead><tr><th>Method</th><th className="num">Utility</th><th className="num">Utilization</th><th className="num">Runtime</th><th className="num">Violations</th><th className="num">Gap</th></tr></thead>
                <tbody>{cmp.methods.map((m) => <tr key={m.key} className={cmp.best_methods_tied.includes(m.method) ? "best" : ""}><td>{m.method}</td><td className="num">{fmt(m.utility)}</td><td className="num">{(m.mean_utilization * 100).toFixed(1)}%</td><td className="num">{ms(m.runtime_ms)}</td><td className="num">{m.n_violations}</td><td className="num">{gapStr(m.optimality_gap_pct)}</td></tr>)}</tbody></table>
            </Panel>
          )}
          <p className="text-[0.75rem] text-ink-soft">Reproduce: dataset “{problem.name}”, seed {params.seed}. Re-running with the same seed gives identical numbers (runtimes vary slightly with machine load).</p>
        </div>
      )}
    </>
  );
}
