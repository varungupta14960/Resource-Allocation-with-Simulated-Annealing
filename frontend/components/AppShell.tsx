"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { API_BASE } from "@/lib/api";

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/setup", label: "Problem Setup" },
  { href: "/sa", label: "Simulated Annealing" },
  { href: "/compare", label: "Baseline Comparison" },
  { href: "/experiments", label: "Experiments" },
  { href: "/sensitivity", label: "Parameter Sensitivity" },
  { href: "/exact", label: "Exact Optimum" },
  { href: "/results", label: "Results & Analysis" },
  { href: "/conclusion", label: "Conclusion & Future Scope" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { problem, params, online } = useStore();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r-4 border-gold-400 bg-forest-900 text-white md:flex">
        <div className="px-5 pb-4 pt-6">
          <div className="font-serif text-[1.15rem] font-bold leading-snug">Resource Allocation Using Simulated Annealing</div>
          <div className="mt-1 text-[0.72rem] text-mint-300">PBL-13 · FOAI · Woxsen University</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2" aria-label="Main">
          {NAV.map((n, i) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`mb-0.5 flex items-center gap-3 rounded-sm px-3 py-2 text-[0.88rem] ${active(n.href) ? "bg-forest-700 font-semibold text-white" : "text-mint-200 hover:bg-forest-800"}`}>
              <span className={`w-4 text-right text-[0.72rem] tabular-nums ${active(n.href) ? "text-gold-400" : "text-forest-600"}`}>{i + 1}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3">
          <Link href="/demo" className="btn btn-gold w-full">Professor Demo Mode</Link>
          <div className="mt-3 flex items-center gap-2 text-[0.72rem] text-mint-300">
            <span className={`h-2 w-2 rounded-full ${online === null ? "bg-grey-400 bg-gray-400" : online ? "bg-mint-300" : "bg-red-400"}`} />
            {online === null ? "Checking backend…" : online ? `Backend online · ${API_BASE.replace(/^https?:\/\//, "")}` : "Backend offline"}
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="topbar sticky top-0 z-20 border-b border-rule bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 md:hidden" aria-label="Mobile navigation">
            {[...NAV, { href: "/demo", label: "Demo" }].map((n) => (
              <Link key={n.href} href={n.href} className={`whitespace-nowrap text-[0.8rem] ${active(n.href) ? "font-bold text-forest-900 underline decoration-gold-400 decoration-2 underline-offset-4" : "text-ink-soft"}`}>{n.label}</Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2 text-[0.78rem] text-ink-soft">
            <span>Dataset: <b className="text-ink">{problem?.name ?? "loading…"}</b></span>
            {problem && <span>{problem.projects.length} projects · {problem.resources.length} resources</span>}
            <span>Seed: <b className="text-ink">{params.seed}</b></span>
            <span>T₀={params.t0} · α={params.alpha} · T<sub>min</sub>={params.t_min} · chain={params.chain_length}</span>
          </div>
          {online === false && (
            <div role="alert" className="border-t border-danger bg-[#fde9e7] px-5 py-2 text-[0.85rem] text-danger">
              Backend not reachable at {API_BASE}. Start it with <code className="font-mono">cd backend &amp;&amp; uvicorn app.main:app --port 8000</code>, then reload.
            </div>
          )}
        </header>
        <main className="mx-auto max-w-[1180px] px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
