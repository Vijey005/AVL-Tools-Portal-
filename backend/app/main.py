"""
AVL Unified Tools Portal — FastAPI Application Entry Point.

Run with:  uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal, Base
from app.models import User, File, PasswordResetRequest, PasswordChangeRequest, MockEmail  # noqa: F401 — ensure tables are registered
from app.seed import seed_users
from app.routers import users, admin, files, analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed default users."""
    print("[*] AVL Portal -- Starting up...")
    Base.metadata.create_all(bind=engine)
    print("  [db] Tables created / verified")

    db = SessionLocal()
    try:
        seed_users(db)
    finally:
        db.close()

    print("  [ok] Ready!\n")
    yield
    print("[*] Shutting down...")


app = FastAPI(
    title="AVL Unified Tools Portal",
    version="1.0.0",
    description="Backend API for the AVL LMM Planner, Organigram Creator, and Weekly Dashboard",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],               # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(files.router)
app.include_router(analytics.router)


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "app": "AVL Unified Tools Portal",
        "version": "1.0.0",
    }


