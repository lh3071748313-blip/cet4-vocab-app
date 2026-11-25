"""Study queue, spaced repetition review submission, and quiz distractors."""

from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..database import get_conn
from ..schemas import ReviewSubmitRequest
from ..sm2 import compute_sm2

router = APIRouter(prefix="/api/study", tags=["study"])


@router.get("/today")
def get_today_queue(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Return due review words first, followed by new unlearned words up to daily goal."""
    user_id = current_user["id"]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_conn() as conn:
        # 1. Words due for review (next_review_at <= now)
        due_rows = conn.execute(
            """
            SELECT w.*, p.repetitions, p.interval_days, p.ease_factor,
                   p.mastery_level, p.wrong_count, p.is_mistake, p.next_review_at,
                   0 AS is_new
            FROM user_word_progress p
            JOIN words w ON w.id = p.word_id
            WHERE p.user_id = ? AND p.next_review_at <= ?
            ORDER BY p.is_mistake DESC, p.next_review_at ASC
            LIMIT ?
            """,
            (user_id, now_str, limit),
        ).fetchall()

        # 2. Count how many new words were already studied today
        studied_today_row = conn.execute(
            """
            SELECT COUNT(DISTINCT word_id) AS cnt
            FROM study_logs
            WHERE user_id = ? AND study_date = ?
            """,
            (user_id, today_str),
        ).fetchone()
        studied_today = int(studied_today_row["cnt"]) if studied_today_row else 0

        remaining_slots = max(0, limit - len(due_rows))
        new_rows = []
        if remaining_slots > 0:
            new_rows = conn.execute(
                """
                SELECT w.*, 0 AS repetitions, 0 AS interval_days, 2.5 AS ease_factor,
                       0 AS mastery_level, 0 AS wrong_count, 0 AS is_mistake,
                       NULL AS next_review_at, 1 AS is_new
                FROM words w
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_word_progress p
                    WHERE p.user_id = ? AND p.word_id = w.id
                )
                ORDER BY w.frequency DESC, w.id ASC
                LIMIT ?
                """,
                (user_id, remaining_slots),
            ).fetchall()

        # Fetch pool of meanings for 4-option multiple choice quiz distractors
        all_meanings = [
            {"id": r["id"], "meaning": r["meaning"]}
            for r in conn.execute("SELECT id, meaning FROM words LIMIT 200").fetchall()
        ]

    queue = []
    for row in [*due_rows, *new_rows]:
        item = dict(row)
        distractors = [m["meaning"] for m in all_meanings if m["id"] != item["id"]]
        chosen = random.sample(distractors, min(3, len(distractors)))
        options = chosen + [item["meaning"]]
        random.shuffle(options)
        item["quiz_options"] = options
        queue.append(item)

    return {
        "queue": queue,
        "due_count": len(due_rows),
        "new_count": len(new_rows),
        "studied_today": studied_today,
        "daily_goal": current_user["daily_goal"],
    }


@router.post("/review")
def submit_review(
    req: ReviewSubmitRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = current_user["id"]
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    today_str = now_dt.strftime("%Y-%m-%d")

    with get_conn() as conn:
        word_row = conn.execute("SELECT id, word FROM words WHERE id = ?", (req.word_id,)).fetchone()
        if word_row is None:
            raise HTTPException(status_code=404, detail="单词不存在")

        prog = conn.execute(
            "SELECT * FROM user_word_progress WHERE user_id = ? AND word_id = ?",
            (user_id, req.word_id),
        ).fetchone()

        reps = prog["repetitions"] if prog else 0
        interval = prog["interval_days"] if prog else 0
        ef = prog["ease_factor"] if prog else 2.5
        wrong_count = prog["wrong_count"] if prog else 0

        res = compute_sm2(req.action, reps, interval, ef, now=now_dt)
        new_wrong_count = wrong_count + res.wrong_count_delta
        # If in mistake mode and user got it known, clear active mistake flag
        is_mistake = 0 if (req.mode == "mistake" and req.action == "known") else (
            1 if res.is_mistake else (prog["is_mistake"] if prog and req.action != "known" else 0)
        )

        if prog is None:
            conn.execute(
                """
                INSERT INTO user_word_progress
                    (user_id, word_id, repetitions, interval_days, ease_factor,
                     mastery_level, wrong_count, is_mistake, last_review_at, next_review_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    req.word_id,
                    res.repetitions,
                    res.interval_days,
                    res.ease_factor,
                    res.mastery_level,
                    new_wrong_count,
                    is_mistake,
                    now_str,
                    res.next_review_at,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE user_word_progress
                SET repetitions = ?, interval_days = ?, ease_factor = ?,
                    mastery_level = ?, wrong_count = ?, is_mistake = ?,
                    last_review_at = ?, next_review_at = ?
                WHERE user_id = ? AND word_id = ?
                """,
                (
                    res.repetitions,
                    res.interval_days,
                    res.ease_factor,
                    res.mastery_level,
                    new_wrong_count,
                    is_mistake,
                    now_str,
                    res.next_review_at,
                    user_id,
                    req.word_id,
                ),
            )

        conn.execute(
            """
            INSERT INTO study_logs (user_id, word_id, study_date, action, mode, is_correct)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                req.word_id,
                today_str,
                req.action,
                req.mode,
                1 if req.action == "known" else 0,
            ),
        )

    return {
        "word_id": req.word_id,
        "mastery_level": res.mastery_level,
        "interval_days": res.interval_days,
        "next_review_at": res.next_review_at,
        "is_mistake": bool(is_mistake),
    }
