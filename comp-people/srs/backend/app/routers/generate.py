import logging
import uuid

from fastapi import APIRouter, Depends, Request, Response

from app.core import state
from app.core.errors import api_error
from app.core.moderation import check_prompt, normalize
from app.core.ratelimit import enforce
from app.models.schemas import GenerateRequest, GenerateResponse
from app.providers.base import ImageProvider, StoredImage, UnsafePrompt
from app.providers.registry import get_image_provider

log = logging.getLogger("audiocanvas")

router = APIRouter(tags=["generate"])


@router.post("/generate", response_model=GenerateResponse)
def generate(
    body: GenerateRequest,
    request: Request,
    provider: ImageProvider = Depends(get_image_provider),
) -> GenerateResponse:
    lang = body.language
    verdict = check_prompt(body.prompt)
    if not verdict.ok:
        raise api_error(422, verdict.code, lang)

    key = f"{lang}:{normalize(body.prompt)}"
    cached_id = state.prompt_index.get(key)
    if cached_id and (stored := state.images.get(cached_id)):
        return GenerateResponse(
            image_id=stored.image_id,
            image_url=f"/api/images/{stored.image_id}",
            prompt=stored.prompt,
            cached=True,
        )

    # Лимит считаем только для реальных обращений к провайдеру
    enforce(state.generate_limiter, request, lang)
    try:
        result = provider.generate(body.prompt.strip())
    except UnsafePrompt as exc:
        raise api_error(422, "unsafe_prompt", lang) from exc
    except Exception as exc:  # noqa: BLE001 — любая ошибка провайдера отдаётся ребёнку мягко
        log.warning("generate: ошибка провайдера: %s", exc)
        raise api_error(502, "provider_error", lang) from exc

    stored = StoredImage(uuid.uuid4().hex, body.prompt.strip(), result)
    state.images.set(stored.image_id, stored)
    state.prompt_index.set(key, stored.image_id)
    return GenerateResponse(
        image_id=stored.image_id,
        image_url=f"/api/images/{stored.image_id}",
        prompt=stored.prompt,
        cached=False,
    )


@router.get("/images/{image_id}")
def get_image(image_id: str) -> Response:
    stored = state.images.get(image_id)
    if stored is None:
        raise api_error(404, "image_not_found", "ru")
    return Response(
        content=stored.result.data,
        media_type=stored.result.content_type,
        # SVG от провайдера не должен выполнять скрипты, даже если его откроют напрямую
        headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"},
    )
