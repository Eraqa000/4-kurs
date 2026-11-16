import logging

from fastapi import APIRouter, Depends, Request

from app.core import state
from app.core.errors import api_error
from app.core.moderation import check_output_text
from app.core.ratelimit import enforce
from app.models.schemas import DescribeRequest, DescribeResponse
from app.providers.base import DescriptionProvider
from app.providers.registry import get_description_provider

log = logging.getLogger("audiocanvas")

router = APIRouter(tags=["describe"])


@router.post("/describe", response_model=DescribeResponse)
def describe(
    body: DescribeRequest,
    request: Request,
    provider: DescriptionProvider = Depends(get_description_provider),
) -> DescribeResponse:
    lang = body.language
    stored = state.images.get(body.image_id)
    if stored is None:
        raise api_error(404, "image_not_found", lang)

    # Описание делается один раз сразу на всех языках: так kk и ru всегда говорят об одном и том же
    descriptions = state.descriptions.get(body.image_id)
    cached = descriptions is not None
    if descriptions is None:
        enforce(state.describe_limiter, request, lang)
        try:
            descriptions = provider.describe(stored)
        except Exception as exc:  # noqa: BLE001
            log.warning("describe: ошибка провайдера: %s", exc)
            raise api_error(502, "provider_error", lang) from exc
        # Результат модели тоже проверяем, прежде чем озвучивать ребёнку
        if not all(
            check_output_text(d.alt_text) and check_output_text(d.long_description)
            for d in descriptions.values()
        ):
            raise api_error(502, "provider_error", lang)
        state.descriptions.set(body.image_id, descriptions)

    description = descriptions[lang]
    return DescribeResponse(
        image_id=body.image_id,
        alt_text=description.alt_text,
        long_description=description.long_description,
        language=lang,
        cached=cached,
    )
