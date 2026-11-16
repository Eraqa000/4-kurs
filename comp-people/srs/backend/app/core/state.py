"""Общее состояние приложения: кэши и лимитеры. В тестах сбрасывается через reset_state()."""

from app.core.cache import TTLCache
from app.core.config import get_settings
from app.core.ratelimit import RateLimiter
from app.providers.base import AudioResult, Description, StoredImage

_s = get_settings()

# id картинки → картинка. Описание берётся по id: бэкенд не ходит по чужим URL (защита от SSRF)
images: TTLCache[StoredImage] = TTLCache(_s.cache_ttl_seconds, _s.cache_max_items)
# нормализованный промпт → id картинки (одинаковый запрос не тратит лимит провайдера)
prompt_index: TTLCache[str] = TTLCache(_s.cache_ttl_seconds, _s.cache_max_items)
# id картинки → описания сразу на всех языках
descriptions: TTLCache[dict[str, Description]] = TTLCache(_s.cache_ttl_seconds, _s.cache_max_items)

# (язык + текст) → озвученный звук: экспорт и прослушивание не тратят лимит TTS повторно
audio: TTLCache[AudioResult] = TTLCache(_s.cache_ttl_seconds, 50)

generate_limiter = RateLimiter(_s.rate_generate_per_min)
describe_limiter = RateLimiter(_s.rate_describe_per_min)
tts_limiter = RateLimiter(_s.rate_tts_per_min)


def reset_state() -> None:
    for cache in (images, prompt_index, descriptions, audio):
        cache.clear()
    generate_limiter.reset()
    describe_limiter.reset()
    tts_limiter.reset()
