"""
Industry Grade AI - FastAPI entrypoint.

Wires up CORS, the aggregated v1 router, global error handlers, and DB
startup. Run with:  uvicorn app.main:app --reload
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("industry_grade_ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s (%s)...", settings.APP_NAME, settings.ENV)
    try:
        await init_db()
        logger.info("Database ready (pgvector extension ensured, tables created).")
    except Exception:
        # Don't crash the whole app if the DB isn't reachable at boot in dev;
        # log loudly so it's obvious. In production, prefer failing fast here.
        logger.exception("Database initialization failed - check DATABASE_URL / connectivity.")
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-grade async competitive programming analytics, "
    "ranking, and AI career intelligence platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


# --- Global error handlers ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": settings.APP_NAME}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


# Mount frontend static app if directory exists
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

    @app.get("/app", tags=["Frontend"])
    @app.get("/app/{full_path:path}", tags=["Frontend"])
    async def serve_app(full_path: str = ""):
        file_path = frontend_dir / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dir / "index.html")
