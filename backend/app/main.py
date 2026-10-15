"""FastAPI application entry point.   Run:  uvicorn app.main:app --reload --port 8000"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import router
from .config import CORS_ORIGINS

app = FastAPI(
    title="PBL-13 Resource Allocation using Simulated Annealing",
    version="1.0.0",
    description="Optimisation engine for the PBL-13 project (Woxsen University). Simulated Annealing, baseline "
                "allocation methods, exact enumeration for small instances, experiments and parameter sensitivity. "
                "All results are computed live; nothing is hard-coded.",
)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})
