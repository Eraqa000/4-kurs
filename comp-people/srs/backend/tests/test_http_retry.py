import httpx
import pytest

from app.providers import gemini
from app.providers.http import post_json


def script(responses):
    """httpx.post, который по очереди отдаёт ответы или бросает исключения."""
    calls = []

    def _post(url, headers, json, timeout):  # noqa: A002
        calls.append(url)
        item = responses[min(len(calls) - 1, len(responses) - 1)]
        if isinstance(item, Exception):
            raise item
        return httpx.Response(item, json={"ok": True}, request=httpx.Request("POST", url))

    return _post, calls


def test_retries_temporary_503_then_succeeds(monkeypatch):
    post, calls = script([503, 503, 200])
    monkeypatch.setattr(httpx, "post", post)
    assert post_json("http://x", {}, {}, 1, "t").json() == {"ok": True}
    assert len(calls) == 3


def test_gives_up_after_three_attempts(monkeypatch):
    post, calls = script([503])
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(httpx.HTTPStatusError):
        post_json("http://x", {}, {}, 1, "t")
    assert len(calls) == 3


@pytest.mark.parametrize("status", [400, 401, 403, 404])
def test_does_not_retry_client_errors(monkeypatch, status):
    post, calls = script([status])
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(httpx.HTTPStatusError):
        post_json("http://x", {}, {}, 1, "t")
    assert len(calls) == 1


def test_retries_network_errors(monkeypatch):
    post, calls = script([httpx.ConnectError("boom"), 200])
    monkeypatch.setattr(httpx, "post", post)
    post_json("http://x", {}, {}, 1, "t")
    assert len(calls) == 2


def test_gemini_503_message_is_clear_after_retries(monkeypatch):
    post, _ = script([503])
    monkeypatch.setattr(httpx, "post", post)
    with pytest.raises(gemini.GeminiError, match="503"):
        gemini.GeminiTranslator("K", "m").to_english("кот")
