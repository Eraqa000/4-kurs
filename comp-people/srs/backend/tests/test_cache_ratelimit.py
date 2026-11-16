import time

from app.core.cache import TTLCache
from app.core.ratelimit import RateLimiter


def test_cache_ttl_and_eviction():
    cache = TTLCache[int](ttl_seconds=0.05, max_items=2)
    cache.set("a", 1)
    assert cache.get("a") == 1
    time.sleep(0.07)
    assert cache.get("a") is None
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)
    assert cache.get("a") is None
    assert cache.get("c") == 3


def test_rate_limiter():
    limiter = RateLimiter(2)
    assert limiter.check("x") == 0
    assert limiter.check("x") == 0
    assert limiter.check("x") > 0
    assert limiter.check("y") == 0
