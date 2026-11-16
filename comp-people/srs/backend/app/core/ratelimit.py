"""Ограничение частоты запросов (скользящее окно, 60 секунд) на клиента."""

import math
import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.errors import api_error

WINDOW = 60.0


class RateLimiter:
    def __init__(self, limit: int):
        self.limit = limit
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> float:
        """Возвращает 0, если запрос разрешён, иначе — сколько секунд ждать."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - WINDOW:
                hits.popleft()
            if len(hits) >= self.limit:
                return WINDOW - (now - hits[0])
            hits.append(now)
            return 0.0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


def client_key(request: Request) -> str:
    # После появления аутентификации ключом станет id пользователя
    return request.client.host if request.client else "unknown"


def enforce(limiter: RateLimiter, request: Request, lang: str) -> None:
    wait = limiter.check(client_key(request))
    if wait > 0:
        raise api_error(
            429, "rate_limited", lang, headers={"Retry-After": str(max(1, math.ceil(wait)))}
        )
