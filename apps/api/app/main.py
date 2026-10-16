from fastapi import FastAPI

from app.core.errors import register_error_handlers
from app.routers import attempts, drill_runs, drills, health, practice_sessions, tags


def create_app() -> FastAPI:
    app = FastAPI(title="Cue Sense API")
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(drills.router)
    app.include_router(tags.router)
    app.include_router(practice_sessions.router)
    app.include_router(drill_runs.router)
    app.include_router(attempts.router)
    return app


app = create_app()
