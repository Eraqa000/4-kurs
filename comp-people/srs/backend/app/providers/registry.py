from app.core.config import get_settings
from app.providers.base import DescriptionProvider, ImageProvider, TTSProvider
from app.providers.cloudflare import CloudflareImageProvider
from app.providers.gemini import (
    GeminiDescriptionProvider,
    GeminiImageProvider,
    GeminiTranslator,
    GeminiTTSProvider,
)
from app.providers.stub import StubDescriptionProvider, StubImageProvider, StubTTSProvider
from app.providers.translating import TranslatingImageProvider


def get_image_provider() -> ImageProvider:
    s = get_settings()
    if s.image_provider == "stub":
        return StubImageProvider()
    if s.image_provider == "gemini":
        if not s.image_api_key:
            raise RuntimeError("IMAGE_PROVIDER=gemini, но IMAGE_API_KEY не задан")
        return GeminiImageProvider(s.image_api_key, s.gemini_image_model)
    if s.image_provider == "cloudflare":
        if not (s.cloudflare_account_id and s.cloudflare_api_token):
            raise RuntimeError(
                "IMAGE_PROVIDER=cloudflare: задай CLOUDFLARE_ACCOUNT_ID и CLOUDFLARE_API_TOKEN"
            )
        inner = CloudflareImageProvider(
            s.cloudflare_account_id, s.cloudflare_api_token, s.cloudflare_image_model
        )
        if s.translate_prompts and s.vision_api_key:
            return TranslatingImageProvider(
                inner, GeminiTranslator(s.vision_api_key, s.gemini_vision_model)
            )
        return inner
    raise RuntimeError(
        f"Неизвестный IMAGE_PROVIDER: {s.image_provider!r}. Доступно: stub, gemini, cloudflare"
    )


def get_description_provider() -> DescriptionProvider:
    s = get_settings()
    if s.description_provider == "stub":
        return StubDescriptionProvider()
    if s.description_provider == "gemini":
        if not s.vision_api_key:
            raise RuntimeError("DESCRIPTION_PROVIDER=gemini, но VISION_API_KEY не задан")
        return GeminiDescriptionProvider(s.vision_api_key, s.gemini_vision_model)
    raise RuntimeError(
        f"Неизвестный DESCRIPTION_PROVIDER: {s.description_provider!r}. Доступно: stub, gemini"
    )


def get_tts_provider() -> TTSProvider:
    s = get_settings()
    if s.tts_provider == "stub":
        return StubTTSProvider()
    if s.tts_provider == "gemini":
        if not s.vision_api_key:
            raise RuntimeError("TTS_PROVIDER=gemini, но VISION_API_KEY не задан")
        return GeminiTTSProvider(s.vision_api_key, s.gemini_tts_model, s.gemini_tts_voice)
    raise RuntimeError(f"Неизвестный TTS_PROVIDER: {s.tts_provider!r}. Доступно: stub, gemini")
