import base64

import httpx
import pytest

from app.core.audio import to_mp3
from app.providers import gemini
from app.providers.base import AudioResult
from app.providers.stub import StubTTSProvider

WAV = StubTTSProvider().synthesize("тест тест тест", "ru").data


def test_gemini_tts_parses_audio_block(monkeypatch):
    sent = []

    def post(url, headers, json, timeout):  # noqa: A002
        sent.append(json)
        body = {
            "steps": [
                {
                    "content": [
                        {
                            "type": "audio",
                            "data": base64.b64encode(WAV).decode(),
                            "mime_type": "audio/wav",
                        }
                    ]
                }
            ]
        }
        return httpx.Response(200, json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", post)
    out = gemini.GeminiTTSProvider("K", "m", "Kore").synthesize("Сәлем", "kk")
    assert out.data == WAV
    assert out.content_type == "audio/wav"
    assert sent[0]["input"] == [{"type": "user_input", "content": "Сәлем"}]
    assert sent[0]["generation_config"]["speech_config"] == [{"voice": "Kore"}]


def test_gemini_tts_without_audio(monkeypatch):
    monkeypatch.setattr(
        httpx,
        "post",
        lambda url, headers, json, timeout: httpx.Response(
            200, json={"steps": []}, request=httpx.Request("POST", url)
        ),
    )
    with pytest.raises(gemini.GeminiError):
        gemini.GeminiTTSProvider("K", "m", "Kore").synthesize("x", "kk")


def test_to_mp3_falls_back_to_original_on_garbage():
    audio = AudioResult(b"not a wav", "audio/wav")
    assert to_mp3(audio) is audio


def test_to_mp3_converts_real_wav_if_ffmpeg_present():
    import shutil

    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg не установлен")
    out = to_mp3(AudioResult(WAV, "audio/wav"))
    assert out.content_type == "audio/mpeg"
    assert out.data[:3] == b"ID3" or out.data[0] == 0xFF
