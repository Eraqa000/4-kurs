from fastapi import HTTPException

from app.core.i18n import message


def api_error(status: int, code: str, lang: str, headers: dict[str, str] | None = None):
    """Ошибка в едином формате: {"detail": {"code": ..., "message": ...}}."""
    return HTTPException(
        status_code=status,
        detail={"code": code, "message": message(code, lang)},
        headers=headers,
    )
