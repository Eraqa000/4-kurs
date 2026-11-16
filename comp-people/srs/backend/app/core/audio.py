"""Работа со звуком: конвертация WAV в MP3, если на сервере есть ffmpeg."""

import shutil
import subprocess

from app.providers.base import AudioResult


def to_mp3(audio: AudioResult) -> AudioResult:
    """Возвращает MP3, а если ffmpeg недоступен или упал — исходный звук без изменений."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or audio.content_type == "audio/mpeg":
        return audio
    try:
        proc = subprocess.run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                "pipe:0",
                "-f",
                "mp3",
                "-b:a",
                "96k",
                "pipe:1",
            ],
            input=audio.data,
            capture_output=True,
            timeout=60,
            check=True,
        )
    except (subprocess.SubprocessError, OSError):
        return audio
    return AudioResult(proc.stdout, "audio/mpeg") if proc.stdout else audio
