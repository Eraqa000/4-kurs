"""Заглушки провайдеров: работают без ключей и интернета.

Картинка — простая SVG-сцена из трёх фигур (слева, в центре, справа), и описание
честно перечисляет именно то, что нарисовано. Так весь сценарий проверяется до выбора
реальных сервисов.
"""

import hashlib
import io
import math
import struct
import wave
from xml.sax.saxutils import escape

from app.providers.base import (
    LANGUAGES,
    AudioResult,
    Description,
    DescriptionProvider,
    ImageProvider,
    ImageResult,
    StoredImage,
    TTSProvider,
)

# (hex, ru, kk). Все фигуры мужского рода, поэтому прилагательные в одной форме
_COLORS = [
    ("#d62828", "красный", "қызыл"),
    ("#1d4ed8", "синий", "көк"),
    ("#15803d", "зелёный", "жасыл"),
    ("#f59e0b", "оранжевый", "қызғылт сары"),
    ("#7e22ce", "фиолетовый", "күлгін"),
]
_BACKGROUNDS = [
    ("#fff8dc", "светло-жёлтом", "ашық сары"),
    ("#e6f2ff", "светло-голубом", "ашық көгілдір"),
    ("#e8f5e9", "светло-зелёном", "ашық жасыл"),
]
_SHAPES = [
    ("circle", "круг", "шеңбер"),
    ("square", "квадрат", "шаршы"),
    ("triangle", "треугольник", "үшбұрыш"),
]


def _shape_svg(kind: str, color: str, cx: int) -> str:
    cy = 300
    if kind == "circle":
        return f'<circle cx="{cx}" cy="{cy}" r="70" fill="{color}"/>'
    if kind == "square":
        return f'<rect x="{cx - 70}" y="{cy - 70}" width="140" height="140" fill="{color}"/>'
    return (
        f'<polygon points="{cx},{cy - 75} {cx - 75},{cy + 65} {cx + 75},{cy + 65}" fill="{color}"/>'
    )


class StubImageProvider(ImageProvider):
    def generate(self, prompt: str) -> ImageResult:
        digest = hashlib.sha256(prompt.encode()).digest()
        bg = _BACKGROUNDS[digest[0] % len(_BACKGROUNDS)]
        # три разных цвета подряд, чтобы фигуры отличались
        start = digest[1] % len(_COLORS)
        colors = [_COLORS[(start + i) % len(_COLORS)] for i in range(3)]
        shapes = [_SHAPES[(digest[2] + i) % len(_SHAPES)] for i in range(3)]
        xs = [110, 256, 402]
        body = "".join(
            _shape_svg(s[0], c[0], x) for s, c, x in zip(shapes, colors, xs, strict=True)
        )
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">'
            f"<title>{escape(prompt)}</title>"
            f'<rect width="512" height="512" fill="{bg[0]}"/>{body}</svg>'
        )
        meta = {
            "background": {"ru": bg[1], "kk": bg[2]},
            "items": [
                {"shape": {"ru": s[1], "kk": s[2]}, "color": {"ru": c[1], "kk": c[2]}}
                for s, c in zip(shapes, colors, strict=True)
            ],
        }
        return ImageResult(svg.encode(), "image/svg+xml", meta)


class StubDescriptionProvider(DescriptionProvider):
    def describe(self, image: StoredImage) -> dict[str, Description]:
        return {lang: self._describe(image, lang) for lang in LANGUAGES}

    def _describe(self, image: StoredImage, lang: str) -> Description:
        meta = image.result.meta
        items = meta["items"]
        bg = meta["background"][lang]
        left, center, right = items
        if lang == "kk":
            alt = f"«{image.prompt}» сұранысы бойынша жасалған сурет: үш геометриялық фигура."
            long = (
                f"Сурет {bg} түсті фонда салынған. "
                f"Сол жақта {left['color']['kk']} {left['shape']['kk']} бар. "
                f"Ортада {center['color']['kk']} {center['shape']['kk']} тұр. "
                f"Оң жақта {right['color']['kk']} {right['shape']['kk']} орналасқан. "
                "Бұл сипаттаманы жасанды интеллект жасады."
            )
        else:
            alt = f"Картинка по запросу «{image.prompt}»: три геометрические фигуры."
            long = (
                f"Картинка нарисована на {bg} фоне. "
                f"Слева — {left['color']['ru']} {left['shape']['ru']}. "
                f"В центре — {center['color']['ru']} {center['shape']['ru']}. "
                f"Справа — {right['color']['ru']} {right['shape']['ru']}. "
                "Это описание создано искусственным интеллектом."
            )
        return Description(alt_text=alt, long_description=long)


class StubTTSProvider(TTSProvider):
    """Вместо речи — короткий тон нужной длины (чтобы проверять поток без ключей)."""

    def synthesize(self, text: str, language: str) -> AudioResult:
        rate = 16000
        seconds = min(max(len(text) / 60, 0.3), 3.0)
        frames = b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / rate)))
            for i in range(int(rate * seconds))
        )
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(rate)
            w.writeframes(frames)
        return AudioResult(buf.getvalue(), "audio/wav")
