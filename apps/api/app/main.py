from fastapi import FastAPI

from app.core.errors import register_error_handlers
from app.routers import drills, health, tags


def create_app() -> FastAPI:
    app = FastAPI(title="Cue Sense API")
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(drills.router)
    app.include_router(tags.router)
    return app


app = create_app()
