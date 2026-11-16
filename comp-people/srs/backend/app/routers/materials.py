import hashlib
import io
import re
import sqlite3
import zipfile
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from app.core import state
from app.core.audio import to_mp3
from app.core.db import get_db
from app.core.errors import api_error
from app.core.moderation import check_output_text, contains_personal_data
from app.core.ratelimit import enforce
from app.models.schemas import (
    Language,
    MaterialOut,
    MaterialText,
    SaveMaterialRequest,
    UpdateTextRequest,
)
from app.providers.base import AudioResult, TTSProvider
from app.providers.registry import get_tts_provider
from app.repositories import materials as repo

router = APIRouter(tags=["materials"])

MAX_TEXT = 1500
_OWNER_RE = re.compile(r"^[A-Za-z0-9-]{16,64}$")
_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg"}

Db = Annotated[sqlite3.Connection, Depends(get_db)]


def owner_id(x_owner_id: Annotated[str | None, Header()] = None) -> str:
    """Анонимный идентификатор устройства (аутентификации пока нет, см. README)."""
    if not x_owner_id or not _OWNER_RE.match(x_owner_id):
        raise api_error(401, "owner_required", "ru")
    return x_owner_id


Owner = Annotated[str, Depends(owner_id)]


def _out(m: repo.Material) -> MaterialOut:
    return MaterialOut(
        id=m.id,
        prompt=m.prompt,
        image_url=f"/api/materials/{m.id}/image",
        created_at=m.created_at,
        texts={
            lang: MaterialText(
                alt_text=t.alt_text, long_description=t.long_description, ai_generated=not t.edited
            )
            for lang, t in m.texts.items()
        },
    )


def _own(conn: sqlite3.Connection, material_id: str, owner: str) -> repo.Material:
    m = repo.get(conn, material_id)
    # Чужая работа выглядит так же, как несуществующая
    if m is None or m.owner_id != owner:
        raise api_error(404, "material_not_found", "ru")
    return m


@router.post("/materials", response_model=MaterialOut)
def save_material(body: SaveMaterialRequest, response: Response, conn: Db, owner: Owner):
    stored = state.images.get(body.image_id)
    descriptions = state.descriptions.get(body.image_id)
    if stored is None:
        raise api_error(404, "image_not_found", "ru")
    if descriptions is None:
        raise api_error(409, "describe_first", "ru")
    material, created = repo.save(
        conn,
        owner,
        body.image_id,
        stored.prompt,
        stored.result.data,
        stored.result.content_type,
        descriptions,
    )
    response.status_code = 201 if created else 200
    return _out(material)


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(conn: Db, owner: Owner):
    return [_out(m) for m in repo.list_for_owner(conn, owner)]


@router.get("/materials/{material_id}", response_model=MaterialOut)
def get_material(material_id: str, conn: Db, owner: Owner):
    return _out(_own(conn, material_id, owner))


@router.patch("/materials/{material_id}", response_model=MaterialOut)
def update_material(material_id: str, body: UpdateTextRequest, conn: Db, owner: Owner):
    lang = body.language
    _own(conn, material_id, owner)
    values = {"alt_text": body.alt_text, "long_description": body.long_description}
    for key, value in values.items():
        if value is None:
            continue
        text = value.strip()
        if not text:
            raise api_error(422, "invalid_text", lang)
        if len(text) > MAX_TEXT:
            raise api_error(422, "text_too_long", lang)
        # Правку проверяем так же, как ответ модели: контент остаётся детским, без личных данных
        if not check_output_text(text) or contains_personal_data(text):
            raise api_error(422, "invalid_text", lang)
        values[key] = text
    repo.update_text(conn, material_id, lang, values["alt_text"], values["long_description"])
    return _out(_own(conn, material_id, owner))


@router.delete("/materials/{material_id}", status_code=204)
def delete_material(material_id: str, conn: Db, owner: Owner):
    _own(conn, material_id, owner)
    repo.delete(conn, material_id)
    return Response(status_code=204)


# Дальше — скачивание по id. Идентификатор — случайный 128-битный UUID, поэтому ссылка
# работает как <img src> и <a download> без заголовков; список и правки требуют владельца.


@router.get("/materials/{material_id}/image")
def material_image(material_id: str, conn: Db) -> Response:
    found = repo.image_of(conn, material_id)
    if found is None:
        raise api_error(404, "material_not_found", "ru")
    data, content_type = found
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'"},
    )


def _speech_text(material: repo.Material, language: str) -> str:
    t = material.texts[language]
    return f"{t.alt_text} {t.long_description}"


def _audio_for(text: str, language: str, request: Request, provider: TTSProvider) -> AudioResult:
    key = hashlib.sha256(f"{language}:{text}".encode()).hexdigest()
    cached = state.audio.get(key)
    if cached is not None:
        return cached
    enforce(state.tts_limiter, request, language)
    try:
        result = to_mp3(provider.synthesize(text, language))
    except Exception as exc:  # noqa: BLE001
        raise api_error(502, "tts_failed", language) from exc
    state.audio.set(key, result)
    return result


def _attachment(filename: str) -> dict[str, str]:
    return {"Content-Disposition": f'attachment; filename="{filename}"'}


def _audio_ext(audio: AudioResult) -> str:
    return "mp3" if audio.content_type == "audio/mpeg" else "wav"


@router.get("/materials/{material_id}/audio")
def material_audio(
    material_id: str,
    request: Request,
    conn: Db,
    language: Annotated[Language, Query()] = "kk",
    provider: TTSProvider = Depends(get_tts_provider),
) -> Response:
    material = repo.get(conn, material_id)
    if material is None or language not in material.texts:
        raise api_error(404, "material_not_found", language)
    audio = _audio_for(_speech_text(material, language), language, request, provider)
    return Response(
        content=audio.data,
        media_type=audio.content_type,
        headers=_attachment(f"audiocanvas-{material_id[:8]}-{language}.{_audio_ext(audio)}"),
    )


@router.get("/materials/{material_id}/export")
def export_material(
    material_id: str,
    request: Request,
    conn: Db,
    language: Annotated[Language, Query()] = "kk",
    provider: TTSProvider = Depends(get_tts_provider),
) -> Response:
    """ZIP: картинка + описание текстом + аудио описания."""
    material = repo.get(conn, material_id)
    found = repo.image_of(conn, material_id)
    if material is None or found is None or language not in material.texts:
        raise api_error(404, "material_not_found", language)
    image, content_type = found
    text = material.texts[language]
    audio = _audio_for(_speech_text(material, language), language, request, provider)

    note = {
        "kk": "Сипаттаманы адам түзеткен."
        if text.edited
        else "Сипаттаманы жасанды интеллект жасады.",
        "ru": "Описание отредактировано человеком."
        if text.edited
        else "Описание создано искусственным интеллектом.",
    }[language]
    description = f"{material.prompt}\n\n{text.alt_text}\n\n{text.long_description}\n\n{note}\n"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"image.{_EXT.get(content_type, 'bin')}", image)
        zf.writestr("description.txt", description)
        zf.writestr(f"description.{_audio_ext(audio)}", audio.data)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers=_attachment(f"audiocanvas-{material_id[:8]}-{language}.zip"),
    )
