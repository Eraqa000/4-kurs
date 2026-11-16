import base64

import httpx
import pytest

from app.core.config import Settings
from app.providers import cloudflare, registry

JPEG = b"\xff\xd8\xff\xe0fake"


def fake_post(response, status=200, captured=None):
    def _post(url, headers, json, timeout):  # noqa: A002
        if captured is not None:
            captured.append({"url": url, "headers": headers, "json": json})
        return httpx.Response(status, json=response, request=httpx.Request("POST", url))

    return _post


def make():
    return cloudflare.CloudflareImageProvider(
        "ACC", "TOKEN", "@cf/black-forest-labs/flux-1-schnell"
    )


def test_generate_ok(monkeypatch):
    sent = []
    body = {"success": True, "result": {"image": base64.b64encode(JPEG).decode()}}
    monkeypatch.setattr(httpx, "post", fake_post(body, captured=sent))
    result = make().generate("кот")
    assert result.data == JPEG
    assert result.content_type == "image/jpeg"
    assert sent[0]["url"].endswith("/accounts/ACC/ai/run/@cf/black-forest-labs/flux-1-schnell")
    assert sent[0]["headers"]["Authorization"] == "Bearer TOKEN"
    assert sent[0]["json"]["prompt"].endswith("кот")


@pytest.mark.parametrize(
    "body",
    [
        {"success": False, "result": None, "errors": [{"message": "x"}]},
        {"success": True, "result": {}},
        {"success": True, "result": {"image": base64.b64encode(b"<svg/>").decode()}},
        {"success": True, "result": {"image": "!!!not base64!!!"}},
    ],
)
def test_generate_rejects_bad_responses(monkeypatch, body):
    monkeypatch.setattr(httpx, "post", fake_post(body))
    with pytest.raises(cloudflare.CloudflareError):
        make().generate("кот")


def test_http_error_does_not_leak_token(monkeypatch):
    monkeypatch.setattr(httpx, "post", fake_post({}, status=429))
    with pytest.raises(cloudflare.CloudflareError) as e:
        make().generate("кот")
    assert "TOKEN" not in str(e.value)


def test_registry_cloudflare(monkeypatch):
    monkeypatch.setattr(
        registry, "get_settings", lambda: Settings(_env_file=None, image_provider="cloudflare")
    )
    with pytest.raises(RuntimeError, match="CLOUDFLARE"):
        registry.get_image_provider()
    ok = Settings(
        _env_file=None,
        image_provider="cloudflare",
        cloudflare_account_id="a",
        cloudflare_api_token="t",
    )
    monkeypatch.setattr(registry, "get_settings", lambda: ok)
    assert isinstance(registry.get_image_provider(), cloudflare.CloudflareImageProvider)


def test_http_status_error_reports_status_and_reason_without_token(monkeypatch):
    def post(url, headers, json, timeout):  # noqa: A002
        return httpx.Response(
            429,
            text='{"errors":[{"message":"daily neurons limit"}]}',
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(cloudflare.CloudflareError) as e:
        make().generate("кот")
    assert "429" in str(e.value)
    assert "daily neurons limit" in str(e.value)
    assert "TOKEN" not in str(e.value)
