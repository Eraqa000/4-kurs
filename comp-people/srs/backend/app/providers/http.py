"""Общий HTTP-вызов внешних ИИ-сервисов с повтором при временных сбоях."""

import logging
import time

import httpx

log = logging.getLogger("audiocanvas")

# 429 и 5xx у ИИ-сервисов чаще всего временные («высокая нагрузка»), ключ тут ни при чём
RETRY_STATUSES = {429, 500, 502, 503, 504}
DELAYS = (1.5, 4.0)  # паузы между попытками, секунды: всего до трёх попыток

_sleep = time.sleep


def post_json(url: str, headers: dict, payload: dict, timeout: float, label: str) -> httpx.Response:
    """POST с повтором на временные ошибки. Возвращает успешный ответ или бросает httpx-ошибку."""
    for attempt in range(len(DELAYS) + 1):
        try:
            res = httpx.post(url, headers=headers, json=payload, timeout=timeout)
            res.raise_for_status()
            return res
        except httpx.HTTPStatusError as exc:
            retryable = exc.response.status_code in RETRY_STATUSES
            if not retryable or attempt == len(DELAYS):
                raise
            log.warning(
                "%s: HTTP %s, повтор через %.1f с", label, exc.response.status_code, DELAYS[attempt]
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            if attempt == len(DELAYS):
                raise
            log.warning(
                "%s: %s, повтор через %.1f с", label, exc.__class__.__name__, DELAYS[attempt]
            )
        _sleep(DELAYS[attempt])
    raise AssertionError("недостижимо")  # pragma: no cover
