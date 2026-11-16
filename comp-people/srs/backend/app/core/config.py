"""Конфигурация из переменных окружения (.env). Ключи API живут только здесь, на бэкенде."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str = ""
    supabase_service_key: str = ""
    image_provider: str = "stub"
    description_provider: str = "stub"
    image_api_key: str = ""
    vision_api_key: str = ""

    # Модели Gemini (Interactions API); меняются без правки кода
    gemini_image_model: str = "gemini-3.1-flash-lite-image"
    gemini_vision_model: str = "gemini-3.1-flash-lite"

    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_image_model: str = "@cf/black-forest-labs/flux-1-schnell"

    # Локальная БД SQLite (путь относительно папки backend)
    database_path: str = "data/audiocanvas.db"

    # Озвучка для экспорта аудиофайла: stub | gemini
    tts_provider: str = "stub"
    gemini_tts_model: str = "gemini-3.8-flash-lite-tts"
    gemini_tts_voice: str = "Kore"
    rate_tts_per_min: int = 6

    # Переводить запросы на английский перед генерацией (нужен VISION_API_KEY)
    translate_prompts: bool = True

    # Лимиты запросов с одного клиента в минуту (экономия бесплатных лимитов ИИ)
    rate_generate_per_min: int = 10
    rate_describe_per_min: int = 20
    # Время жизни кэша и хранилища картинок, секунды
    cache_ttl_seconds: int = 3600
    cache_max_items: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()
