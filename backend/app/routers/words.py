"""Vocabulary dictionary search and bulk JSON import routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from ..auth import get_current_user
from ..database import get_conn
from ..schemas import WordImportItem

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("")
def list_words(
    q: str = Query(default="", max_length=64),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    offset = (page - 1) * page_size
    keyword = f"%{q.strip()}%"
    user_id = current_user["id"]

    with get_conn() as conn:
        if q.strip():
            total = int(
                conn.execute(
                    "SELECT COUNT(*) FROM words WHERE word LIKE ? OR meaning LIKE ?",
                    (keyword, keyword),
                ).fetchone()[0]
            )
            rows = conn.execute(
                """
                SELECT w.*, COALESCE(p.mastery_level, 0) AS mastery_level,
                       COALESCE(p.is_mistake, 0) AS is_mistake
                FROM words w
                LEFT JOIN user_word_progress p
                  ON p.word_id = w.id AND p.user_id = ?
                WHERE w.word LIKE ? OR w.meaning LIKE ?
                ORDER BY w.frequency DESC, w.word ASC
                LIMIT ? OFFSET ?
                """,
                (user_id, keyword, keyword, page_size, offset),
            ).fetchall()
        else:
            total = int(conn.execute("SELECT COUNT(*) FROM words").fetchone()[0])
            rows = conn.execute(
                """
                SELECT w.*, COALESCE(p.mastery_level, 0) AS mastery_level,
                       COALESCE(p.is_mistake, 0) AS is_mistake
                FROM words w
                LEFT JOIN user_word_progress p
                  ON p.word_id = w.id AND p.user_id = ?
                ORDER BY w.frequency DESC, w.id ASC
                LIMIT ? OFFSET ?
                """,
                (user_id, page_size, offset),
            ).fetchall()

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/import")
def import_words(
    items: list[WordImportItem],
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Allow importing custom CET-4 vocabulary lists."""
    with get_conn() as conn:
        before = int(conn.execute("SELECT COUNT(*) FROM words").fetchone()[0])
        conn.executemany(
            """
            INSERT OR IGNORE INTO words
                (word, phonetic, pos, meaning, example, example_cn, mnemonic, frequency, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    item.word.strip(),
                    item.phonetic,
                    item.pos,
                    item.meaning,
                    item.example,
                    item.example_cn,
                    item.mnemonic,
                    item.frequency,
                    item.tags,
                )
                for item in items
                if item.word.strip()
            ],
        )
        after = int(conn.execute("SELECT COUNT(*) FROM words").fetchone()[0])
    return {"inserted": after - before, "total": after}
