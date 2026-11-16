import base64
import json

import httpx
import pytest

from app.providers import gemini
from app.providers.base import ImageResult, StoredImage

PNG = b"\x89PNG fake"


def fake_post(response: dict, captured: list):
    def _post(url, headers, json, timeout):  # noqa: A002
        captured.append({"url": url, "headers": headers, "json": json})
        return httpx.Response(200, json=response, request=httpx.Request("POST", url))

    return _post


def test_image_provider_parses_output_image(monkeypatch):
    sent = []
    resp = {"output_image": {"data": base64.b64encode(PNG).decode(), "mime_type": "image/png"}}
    monkeypatch.setattr(httpx, "post", fake_post(resp, sent))
    result = gemini.GeminiImageProvider("KEY", "m").generate("кот")
    assert result.data == PNG
    assert result.content_type == "image/png"
    assert sent[0]["headers"]["x-goog-api-key"] == "KEY"
    assert sent[0]["json"]["model"] == "m"
    assert sent[0]["json"]["input"].endswith("кот")


def test_image_provider_parses_steps_fallback(monkeypatch):
    resp = {
        "steps": [
            {
                "type": "model_output",
                "content": [{"type": "image", "data": base64.b64encode(PNG).decode()}],
            }
        ]
    }
    monkeypatch.setattr(httpx, "post", fake_post(resp, []))
    assert gemini.GeminiImageProvider("K", "m").generate("кот").data == PNG


def test_image_provider_rejects_svg_and_missing_image(monkeypatch):
    svg = {
        "output_image": {"data": base64.b64encode(b"<svg/>").decode(), "mime_type": "image/svg+xml"}
    }
    monkeypatch.setattr(httpx, "post", fake_post(svg, []))
    with pytest.raises(gemini.GeminiError):
        gemini.GeminiImageProvider("K", "m").generate("кот")
    monkeypatch.setattr(httpx, "post", fake_post({"steps": []}, []))
    with pytest.raises(gemini.GeminiError):
        gemini.GeminiImageProvider("K", "m").generate("кот")


def test_description_provider_returns_both_languages_from_one_call(monkeypatch):
    sent = []
    text = json.dumps(
        {
            "ru": {"alt_text": "Кот на крыше.", "long_description": "Слева дом. Справа кот."},
            "kk": {
                "alt_text": "Шатырдағы мысық.",
                "long_description": "Сол жақта үй. Оң жақта мысық.",
            },
        }
    )
    monkeypatch.setattr(httpx, "post", fake_post({"output_text": text}, sent))
    stored = StoredImage("id", "кот", ImageResult(PNG, "image/png"))
    d = gemini.GeminiDescriptionProvider("K", "m").describe(stored)
    assert len(sent) == 1
    assert d["ru"].alt_text == "Кот на крыше."
    assert d["kk"].alt_text == "Шатырдағы мысық."
    parts = sent[0]["json"]["input"]
    assert "SAME description translated into Kazakh" in parts[0]["text"]
    assert parts[1]["data"] == base64.b64encode(PNG).decode()
    assert sent[0]["json"]["response_format"]["mime_type"] == "application/json"


@pytest.mark.parametrize(
    "output",
    [
        "не json",
        json.dumps({"ru": {"alt_text": "a", "long_description": "b"}}),  # нет kk
        json.dumps(
            {
                "ru": {"alt_text": "a", "long_description": "b"},
                "kk": {"alt_text": "", "long_description": "d"},
            }
        ),
    ],
)
def test_description_provider_rejects_bad_output(monkeypatch, output):
    monkeypatch.setattr(httpx, "post", fake_post({"output_text": output}, []))
    stored = StoredImage("id", "кот", ImageResult(PNG, "image/png"))
    with pytest.raises(gemini.GeminiError):
        gemini.GeminiDescriptionProvider("K", "m").describe(stored)


def test_translator(monkeypatch):
    sent = []
    monkeypatch.setattr(httpx, "post", fake_post({"output_text": ' "A cat on a roof." \n'}, sent))
    assert gemini.GeminiTranslator("K", "m").to_english("кот на крыше") == "A cat on a roof."
    assert sent[0]["json"]["input"].endswith("Request: кот на крыше")


def test_http_error_does_not_leak_key(monkeypatch):
    def boom(url, headers, json, timeout):  # noqa: A002
        raise httpx.ConnectError("secret-key-in-url?")

    monkeypatch.setattr(httpx, "post", boom)
    with pytest.raises(gemini.GeminiError) as e:
        gemini.GeminiImageProvider("SECRETKEY", "m").generate("кот")
    assert "SECRETKEY" not in str(e.value)


def test_registry_requires_key(monkeypatch):
    from app.core.config import Settings
    from app.providers import registry

    monkeypatch.setattr(
        registry,
        "get_settings",
        lambda: Settings(_env_file=None, image_provider="gemini", image_api_key=""),
    )
    with pytest.raises(RuntimeError, match="IMAGE_API_KEY"):
        registry.get_image_provider()
