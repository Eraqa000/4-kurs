"""Интерфейсы адаптеров ИИ-сервисов. Роутеры работают только с ними."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ImageResult:
    data: bytes
    content_type: str
    # Что нарисовано: нужно описателю-заглушке, реальные провайдеры могут оставить пустым
    meta: dict = field(default_factory=dict)


@dataclass
class Description:
    alt_text: str  # одно предложение
    long_description: str  # композиция, цвета, объекты, расположение


@dataclass
class StoredImage:
    image_id: str
    prompt: str
    result: ImageResult


class UnsafePrompt(Exception):
    """Запрос признан небезопасным уже после обработки провайдером (например, после перевода)."""


LANGUAGES = ("kk", "ru")


@dataclass
class AudioResult:
    data: bytes
    content_type: str  # audio/wav или audio/mpeg


class TTSProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, language: str) -> AudioResult: ...


class ImageProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> ImageResult: ...


class DescriptionProvider(ABC):
    @abstractmethod
    def describe(self, image: StoredImage) -> dict[str, Description]:
        """Описание картинки сразу на всех языках из LANGUAGES.

        Один проход по картинке гарантирует, что kk и ru описывают одно и то же.
        """
        ...
