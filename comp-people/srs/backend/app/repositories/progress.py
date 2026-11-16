import sqlite3

# done нельзя понизить повторным прохождением урока
_RANK = {"not_started": 0, "in_progress": 1, "done": 2}


def get_all(conn: sqlite3.Connection, owner_id: str) -> dict[str, str]:
    rows = conn.execute(
        "SELECT lesson_id, status FROM lesson_progress WHERE owner_id = ?", (owner_id,)
    ).fetchall()
    return {r["lesson_id"]: r["status"] for r in rows}


def set_status(conn: sqlite3.Connection, owner_id: str, lesson_id: str, status: str) -> str:
    """Записывает статус, не понижая достигнутый. Возвращает итоговый статус."""
    current = conn.execute(
        "SELECT status FROM lesson_progress WHERE owner_id = ? AND lesson_id = ?",
        (owner_id, lesson_id),
    ).fetchone()
    if current and _RANK[current["status"]] >= _RANK[status]:
        return current["status"]
    with conn:
        conn.execute(
            "INSERT INTO lesson_progress (owner_id, lesson_id, status) VALUES (?, ?, ?) "
            "ON CONFLICT (owner_id, lesson_id) DO UPDATE SET status = excluded.status, "
            "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
            (owner_id, lesson_id, status),
        )
    return status
