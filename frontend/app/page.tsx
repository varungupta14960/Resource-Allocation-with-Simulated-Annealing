"use client";
import Link from "next/link";
import { FigureStrip, Figure, Panel, InitialTestBadge, Explain } from "@/components/ui";
import { useStore } from "@/lib/store";
import { EXACT_UNAVAILABLE, fmt, gapStr, ms } from "@/lib/format";

export default function Overview() {
  const { problem, results, datasets } = useStore();
  const cmp = results.compare;
  const sa = results.sa ?? cmp?.sa_run;
  const best = sa?.best;
  const gapNote = cmp ? (cmp.exact ? `Exact optimum ${fmt(cmp.exact.utility)}` : EXACT_UNAVAILABLE) : sa ? (sa.exact_utility !== null ? `Exact optimum ${fmt(sa.exact_utility)}` : EXACT_UNAVAILABLE) : "Run SA to compute";
  const steps = [
    { label: "Problem input", href: "/setup", done: !!problem, text: "Projects, resources, capacities, a_ij" },
    { label: "Initial solution", href: "/sa", done: !!sa, text: "Random feasible start" },
    { label: "Simulated annealing", href: "/sa", done: !!sa, text: "Neighbour → ΔE → accept/reject → cool" },
    { label: "Best allocation", href: "/sa", done: !!best, text: "Best feasible state visited" },
    { label: "Baseline comparison", href: "/compare", done: !!cmp, text: "Equal · Greedy · Random · Exact" },
    { label: "Analysis", href: "/results", done: !!results.experiment, text: "30 runs, sensitivity, summary" },
  ];
  return (
    <>
      <section className="mb-7 grid gap-6 border-b border-rule pb-7 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className="mb-2 text-[0.82rem] font-semibold text-forest-700">Final Project Review (Review 2) · PBL-13 · Foundations of AI and Optimization</p>
          <h1 className="text-[2.35rem] font-bold leading-[1.1]">Resource Allocation Using Simulated Annealing</h1>
          <p className="mt-4 max-w-2xl text-[1rem] leading-relaxed text-ink-soft">
            A portfolio team has limited budget, manpower and equipment and many competing projects. Each project must receive either nothing or an
            integer number of work units between a minimum viable level L<sub>j</sub> and a maximum U<sub>j</sub>, benefits show diminishing returns, and every
            resource has a hard capacity. This application solves that constrained, non-convex integer problem with <b>Simulated Annealing</b>,
            compares it with equal, greedy and random-feasible allocation, and validates it against the exact optimum on small instances.
            Every number shown is computed live by the Python backend.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/demo?auto=1" className="btn btn-gold">Run Demonstration</Link>
            <Link href="/setup" className="btn btn-ghost">Load a dataset</Link>
            <Link href="/sa" className="btn btn-ghost">Open SA control panel</Link>
          </div>
        </div>
        <Panel title="Mathematical model" subtitle="Reproduced from the Review-1 formulation">
          <div className="space-y-2 text-[0.85rem]">
            <p className="formula">x<sub>j</sub> ∈ {"{0}"} ∪ [L<sub>j</sub>, U<sub>j</sub>], integer</p>
            <p className="formula">U(x) = Σ<sub>j</sub> u<sub>j</sub>(x<sub>j</sub>),  u<sub>j</sub> = v<sub>j</sub>(1 − e<sup>−k<sub>j</sub>x<sub>j</sub></sup>) <Explain topic="utility" /></p>
            <p className="formula">Σ<sub>j</sub> a<sub>ij</sub>x<sub>j</sub> ≤ R<sub>i</sub>  for every resource i</p>
            <p className="formula">E(x) = −U(x) + λ Σ<sub>i</sub> max(0, (Σ<sub>j</sub> a<sub>ij</sub>x<sub>j</sub> − R<sub>i</sub>)/R<sub>i</sub>) <Explain topic="energy" /></p>
            <p className="text-[0.8rem] text-ink-soft">Goal: minimise E(x) ⇒ a high-utility feasible allocation. SA parameters are <InitialTestBadge />: T₀ = 50, α = 0.95, T<sub>min</sub> = 0.01, chain = 100, λ = 10·max v<sub>j</sub>.</p>
          </div>
        </Panel>
      </section>

      <FigureStrip>
        <Figure label="Number of projects" value={problem?.projects.length ?? "—"} note={problem?.name} />
        <Figure label="Number of resources" value={problem?.resources.length ?? "—"} note={problem?.resources.map((r) => r.name.split(" (")[0]).join(", ")} />
        <Figure label="Best utility (SA)" value={best ? fmt(best.utility) : "—"} note={best ? `seed ${sa!.seed}` : "Run SA to compute"} tone="good" />
        <Figure label="Resource utilization" value={best ? `${(best.mean_utilization * 100).toFixed(1)}%` : "—"} note={best ? "mean over resources" : "Run SA to compute"} />
        <Figure label="SA runtime" value={best ? ms(best.runtime_ms) : "—"} note={best ? `${sa!.stats.iterations.toLocaleString()} iterations` : "Run SA to compute"} />
        <Figure label="Optimality gap" value={best ? gapStr(best.optimality_gap_pct) : "—"} note={gapNote} />
      </FigureStrip>

      <h2 className="mb-3 mt-9 text-xl font-bold">Workflow</h2>
      <ol className="grid gap-0 border border-rule bg-white md:grid-cols-6">
        {steps.map((s, i) => (
          <li key={s.label} className="relative border-b border-rule p-3 md:border-b-0 md:border-r md:last:border-r-0">
            <Link href={s.href} className="block">
              <div className="mb-1 flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.75rem] font-bold ${s.done ? "bg-forest-700 text-white" : "bg-mint-200 text-forest-900"}`}>{s.done ? "✓" : i + 1}</span>
                <span className="text-[0.88rem] font-bold text-forest-900">{s.label}</span>
              </div>
              <p className="text-[0.76rem] leading-snug text-ink-soft">{s.text}</p>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        <Panel title="Built-in datasets" subtitle="Load any of them from Problem Setup">
          <table className="tbl">
            <thead><tr><th>Dataset</th><th className="num">n</th><th className="num">m</th><th>Purpose</th><th>Exact search</th></tr></thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id}><td>{d.id}</td><td className="num">{d.n_projects}</td><td className="num">{d.n_resources}</td><td>{d.role}</td>
                  <td>{d.exact_feasible ? <span className="badge badge-green">feasible</span> : <span className="badge badge-grey">too large</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Project team" subtitle="PBL-13 · FOAI · Woxsen University · Guide: Dr. Bhargav">
          <ul className="space-y-1 text-[0.9rem]">
            {[["Varun Manoj Gupta", "25WU0101151"], ["Ishmeet Nahar", "25WU0105008"], ["Sushil Pal", "25WU0101141"], ["Tanishq Hanumanta", "25WU0101142"], ["Suhaan Kapoor", "25WU0104027"]].map(([n, id]) => (
              <li key={id} className="flex justify-between border-b border-rule py-1"><span>{n}</span><span className="tabular-nums text-ink-soft">{id}</span></li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
