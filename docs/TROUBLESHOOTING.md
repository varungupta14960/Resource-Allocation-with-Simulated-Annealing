# Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Red banner “Backend not reachable” | Backend not running or wrong port. `cd backend && uvicorn app.main:app --port 8000`; check http://localhost:8000/api/health. |
| Browser console CORS error | Frontend served from another origin. Add it to `CORS_ORIGINS` (backend env) and restart. Using `127.0.0.1` vs `localhost` both work by default. |
| `ModuleNotFoundError: app` | Run uvicorn from inside `backend/`; run pytest from the project root. |
| `pip` “externally-managed-environment” | Use a virtual environment (`python -m venv .venv`). |
| `npm install` fails / old Node | Need Node 20+. `node --version`. |
| Port 3000/8000 busy | `npx next dev -p 3001` / `uvicorn ... --port 8001`; update `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS`. |
| Live SA charts do not update | A proxy/antivirus buffering SSE; set pacing to 0 or run on localhost without VPN. STOP works by aborting the request. |
| 422 “implies N iterations (limit …)” | α too close to 1 or chain too long; raise `MAX_SA_ITERATIONS` or change parameters. |
| Experiments on `large` take ~30–40 s | Random baseline draws as many samples as SA evaluations in every run; reduce runs or set a smaller sample budget via the API. |
| Exact search button disabled | Instance too large (by design). Load `toy` or `small`. |
| Stale numbers after editing data | Editing the problem clears results on purpose; re-run. |
| Blank page after build | Delete `frontend/.next` and rebuild; ensure `.env.local` has the right API URL. |
