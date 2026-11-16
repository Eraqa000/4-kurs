"""Обёртка над провайдером картинок: переводит запрос на английский и перепроверяет его."""

import logging
from typing import Protocol

from app.core.moderation import contains_unsafe
from app.providers.base import ImageProvider, ImageResult, UnsafePrompt

log = logging.getLogger(__name__)


class Translator(Protocol):
    def to_english(self, text: str) -> str: ...


def _is_ascii(text: str) -> bool:
    return all(ord(c) < 128 for c in text)


class TranslatingImageProvider(ImageProvider):
    def __init__(self, inner: ImageProvider, translator: Translator):
        self._inner = inner
        self._translator = translator

    def generate(self, prompt: str) -> ImageResult:
        english = prompt
        if not _is_ascii(prompt):
            try:
                english = self._translator.to_english(prompt)
            except Exception:  # noqa: BLE001 — без перевода рисуем по исходному запросу
                log.warning("Перевод запроса не удался, используется исходный текст")
        # Перевод мог «раскрыть» то, что не поймал фильтр kk/ru
        if contains_unsafe(english):
            raise UnsafePrompt
        return self._inner.generate(english)
