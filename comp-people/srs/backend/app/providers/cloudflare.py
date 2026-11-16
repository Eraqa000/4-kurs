"""Генерация картинок через Cloudflare Workers AI (FLUX.1 schnell, есть бесплатный лимит).

Размер фиксирован (1024x1024), одна картинка стоит около 173 «нейронов» из 10 000 бесплатных
в сутки — примерно 57 картинок в день. Поэтому важны кэш и лимиты запросов.
"""

import base64

import httpx

from app.providers.base import ImageProvider, ImageResult
from app.providers.http import post_json

TIMEOUT = 90.0

_STYLE = (
    "Simple, clear, friendly illustration for a child. Bright colors, uncluttered "
    "composition with a few clearly separated objects, no text or letters. Subject: "
)


class CloudflareError(RuntimeError):
    pass


class CloudflareImageProvider(ImageProvider):
    def __init__(self, account_id: str, api_token: str, model: str):
        self._url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
        self._token = api_token

    def generate(self, prompt: str) -> ImageResult:
        try:
            res = post_json(
                self._url,
                {"Authorization": f"Bearer {self._token}"},
                {"prompt": _STYLE + prompt, "steps": 4},
                TIMEOUT,
                "Cloudflare",
            )
            body = res.json()
        except httpx.HTTPStatusError as exc:
            body = exc.response.text[:200].replace("\n", " ")
            raise CloudflareError(f"Cloudflare HTTP {exc.response.status_code}: {body}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            # Токен только в заголовке, в текст ошибки он не попадает
            raise CloudflareError(f"Cloudflare request failed: {exc.__class__.__name__}") from exc

        encoded = (body.get("result") or {}).get("image")
        if not body.get("success") or not encoded:
            raise CloudflareError("Cloudflare returned no image")
        try:
            data = base64.b64decode(encoded, validate=True)
        except ValueError as exc:
            raise CloudflareError("Cloudflare returned invalid image data") from exc
        # FLUX отдаёт JPEG; проверяем сигнатуру, чтобы не отдавать клиенту произвольные байты
        if not data.startswith(b"\xff\xd8\xff"):
            raise CloudflareError("Unexpected image format")
        return ImageResult(data, "image/jpeg")
