"""Готовит заранее записанное вступительное аудио для сайта (kk и ru).

Текст берётся из frontend/src/features/intro/intro-texts.json, звук делает Gemini TTS
(нужен VISION_API_KEY в backend/.env), результат: frontend/public/audio/intro-<язык>.mp3.
Запуск из папки backend:  uv run python scripts/generate_intro_audio.py
Аудио пересоздаётся только при изменении текста, в обычной работе сайта TTS не вызывается.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.audio import to_mp3  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.providers.gemini import GeminiTTSProvider  # noqa: E402

texts = json.loads((ROOT / "frontend/src/features/intro/intro-texts.json").read_text("utf-8"))
out_dir = ROOT / "frontend/public/audio"
out_dir.mkdir(parents=True, exist_ok=True)

s = get_settings()
if not s.vision_api_key:
    sys.exit("Нужен VISION_API_KEY в backend/.env")
tts = GeminiTTSProvider(s.vision_api_key, s.gemini_tts_model, s.gemini_tts_voice)

for lang, text in texts.items():
    audio = to_mp3(tts.synthesize(text, lang))
    ext = "mp3" if audio.content_type == "audio/mpeg" else "wav"
    path = out_dir / f"intro-{lang}.{ext}"
    path.write_bytes(audio.data)
    print(f"{lang}: {path.name} {len(audio.data) // 1024} КБ ({audio.content_type})")
