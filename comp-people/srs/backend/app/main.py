from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import init_db
from app.providers.registry import (
    get_description_provider,
    get_image_provider,
    get_tts_provider,
)
from app.routers import describe, generate, health, materials, progress


def create_app() -> FastAPI:
    # Fail fast: неверная конфигурация провайдеров должна ронять запуск, а не первый запрос ребёнка
    get_image_provider()
    get_description_provider()
    get_tts_provider()
    init_db()
    app = FastAPI(title="AudioCanvas API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, prefix="/api")
    app.include_router(generate.router, prefix="/api")
    app.include_router(describe.router, prefix="/api")
    app.include_router(materials.router, prefix="/api")
    app.include_router(progress.router, prefix="/api")
    return app


app = create_app()
