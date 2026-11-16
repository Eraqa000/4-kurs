"""Локальная база SQLite. Файл лежит в backend/data/ (папка в .gitignore)."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path

from app.core.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    source_image_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    image BLOB NOT NULL,
    content_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (owner_id, source_image_id)
);
CREATE INDEX IF NOT EXISTS idx_materials_owner ON materials (owner_id, created_at DESC);

-- Описания по языкам; edited = 1, если текст правил человек (учитель или ребёнок)
CREATE TABLE IF NOT EXISTS material_texts (
    material_id TEXT NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    language TEXT NOT NULL CHECK (language IN ('kk', 'ru')),
    alt_text TEXT NOT NULL,
    long_description TEXT NOT NULL,
    edited INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (material_id, language)
);

-- Прогресс по урокам. Сами уроки живут во фронтенде (kk/ru), здесь только статус
CREATE TABLE IF NOT EXISTS lesson_progress (
    owner_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'done')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (owner_id, lesson_id)
);
"""


def _path() -> str:
    return get_settings().database_path


def connect() -> sqlite3.Connection:
    path = _path()
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


def reset_db() -> None:
    """Очистка таблиц (для тестов)."""
    conn = connect()
    try:
        conn.executescript(
            "DELETE FROM material_texts; DELETE FROM materials; DELETE FROM lesson_progress;"
        )
        conn.commit()
    finally:
        conn.close()
