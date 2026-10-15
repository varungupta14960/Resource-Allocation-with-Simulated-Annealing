# 5–10 minute demonstration script (Review 2)

Before: start backend and frontend, open http://localhost:3000, keep seed = 42.

1. **Overview (0:00–0:45)** – read the problem: limited budget/manpower, integer work units, minimum viable level, diminishing returns. Point at the formulation panel and the workflow strip.
2. **Problem Setup (0:45–1:45)** – click *Load Example Dataset* on `small` (5 projects, 2 resources). Show the editable tables, the constraint matrix, the validation messages and the “exact search: allowed” diagnostic. Mention `medium`/`large` exist.
3. **Simulated Annealing (1:45–3:30)** – show parameters (badge: *Initial Test Values*, not claimed optimal). Click **RUN SIMULATED ANNEALING**; narrate while T falls: current vs best energy, acceptance rate dropping from ~hot to cold, worse moves accepted early. Show **BEST FEASIBLE ALLOCATION** and usage vs capacity (nothing above 100 %).
4. **Baseline Comparison (3:30–5:00)** – *Run all methods*. Read utility/runtime/utilization/violations; point at the highlighted best row and the gap column. Toggle “zoom y-axis” to explain why bars look similar when zero-based.
5. **Exact Optimum (5:00–6:00)** – run exact search; show feasible solutions evaluated, exact utility vs SA utility, optimality gap. Read the warning about exponential growth; show `medium` is disabled.
6. **Experiments (6:00–7:30)** – 30 runs → mean/best/worst/std, box plot, histogram, convergence band; download the CSV.
7. **Parameter Sensitivity (7:30–8:30)** – run the α×T₀ grid; point to heatmaps and “Best observed configuration for this experiment” (stress: not globally optimal).
8. **Results & Analysis / Conclusion (8:30–10:00)** – show the auto-generated statements (all from computed values), then future scope.

Fallback: *Professor Demo Mode* does steps 2–7 in one click (~15 s on `small`).
