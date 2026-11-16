import sqlite3
import uuid
from dataclasses import dataclass

from app.providers.base import Description


@dataclass
class MaterialText:
    alt_text: str
    long_description: str
    edited: bool


@dataclass
class Material:
    id: str
    owner_id: str
    prompt: str
    content_type: str
    created_at: str
    texts: dict[str, MaterialText]


def _texts(conn: sqlite3.Connection, material_id: str) -> dict[str, MaterialText]:
    rows = conn.execute(
        "SELECT language, alt_text, long_description, edited FROM material_texts "
        "WHERE material_id = ?",
        (material_id,),
    ).fetchall()
    return {
        r["language"]: MaterialText(r["alt_text"], r["long_description"], bool(r["edited"]))
        for r in rows
    }


def _build(conn: sqlite3.Connection, row: sqlite3.Row) -> Material:
    return Material(
        row["id"],
        row["owner_id"],
        row["prompt"],
        row["content_type"],
        row["created_at"],
        _texts(conn, row["id"]),
    )


def save(
    conn: sqlite3.Connection,
    owner_id: str,
    source_image_id: str,
    prompt: str,
    image: bytes,
    content_type: str,
    descriptions: dict[str, Description],
) -> tuple[Material, bool]:
    """Сохраняет работу. Повторное сохранение той же картинки возвращает уже готовую запись."""
    existing = conn.execute(
        "SELECT * FROM materials WHERE owner_id = ? AND source_image_id = ?",
        (owner_id, source_image_id),
    ).fetchone()
    if existing:
        return _build(conn, existing), False

    material_id = uuid.uuid4().hex
    with conn:
        conn.execute(
            "INSERT INTO materials (id, owner_id, source_image_id, prompt, image, content_type) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (material_id, owner_id, source_image_id, prompt, image, content_type),
        )
        for lang, d in descriptions.items():
            conn.execute(
                "INSERT INTO material_texts (material_id, language, alt_text, long_description) "
                "VALUES (?, ?, ?, ?)",
                (material_id, lang, d.alt_text, d.long_description),
            )
    return get(conn, material_id), True  # type: ignore[return-value]


def get(conn: sqlite3.Connection, material_id: str) -> Material | None:
    row = conn.execute("SELECT * FROM materials WHERE id = ?", (material_id,)).fetchone()
    return _build(conn, row) if row else None


def list_for_owner(conn: sqlite3.Connection, owner_id: str) -> list[Material]:
    rows = conn.execute(
        "SELECT * FROM materials WHERE owner_id = ? ORDER BY created_at DESC, rowid DESC",
        (owner_id,),
    ).fetchall()
    return [_build(conn, r) for r in rows]


def image_of(conn: sqlite3.Connection, material_id: str) -> tuple[bytes, str] | None:
    row = conn.execute(
        "SELECT image, content_type FROM materials WHERE id = ?", (material_id,)
    ).fetchone()
    return (row["image"], row["content_type"]) if row else None


def update_text(
    conn: sqlite3.Connection,
    material_id: str,
    language: str,
    alt_text: str | None,
    long_description: str | None,
) -> None:
    with conn:
        conn.execute(
            "UPDATE material_texts SET "
            "alt_text = COALESCE(?, alt_text), "
            "long_description = COALESCE(?, long_description), edited = 1 "
            "WHERE material_id = ? AND language = ?",
            (alt_text, long_description, material_id, language),
        )


def delete(conn: sqlite3.Connection, material_id: str) -> None:
    with conn:
        conn.execute("DELETE FROM materials WHERE id = ?", (material_id,))
