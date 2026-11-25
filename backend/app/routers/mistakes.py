"""Mistake notebook routes: list mistakes, resolve/remove mistake."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..database import get_conn

router = APIRouter(prefix="/api/mistakes", tags=["mistakes"])


@router.get("")
def list_mistakes(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT w.*, p.wrong_count, p.mastery_level, p.last_review_at, p.next_review_at
            FROM user_word_progress p
            JOIN words w ON w.id = p.word_id
            WHERE p.user_id = ? AND p.is_mistake = 1
            ORDER BY p.wrong_count DESC, p.last_review_at DESC
            """,
            (current_user["id"],),
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": len(rows)}


@router.delete("/{word_id}")
def resolve_mistake(
    word_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE user_word_progress
            SET is_mistake = 0
            WHERE user_id = ? AND word_id = ?
            """,
            (current_user["id"], word_id),
        )
    return {"ok": True, "word_id": word_id}
