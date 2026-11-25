"""Learning statistics routes: overview, streak, 14-day trend, mastery distribution."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..database import get_conn

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
def get_overview(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    user_id = current_user["id"]
    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.strftime("%Y-%m-%d")
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S")

    with get_conn() as conn:
        total_words = int(conn.execute("SELECT COUNT(*) FROM words").fetchone()[0])

        progress_rows = conn.execute(
            """
            SELECT mastery_level, is_mistake, next_review_at
            FROM user_word_progress
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchall()

        learned_words = len(progress_rows)
        mastered_words = sum(1 for r in progress_rows if r["mastery_level"] >= 3)
        mistake_count = sum(1 for r in progress_rows if r["is_mistake"] == 1)
        due_count = sum(1 for r in progress_rows if r["next_review_at"] <= now_str)

        mastery_dist = {
            "new": max(0, total_words - learned_words),
            "learning": sum(1 for r in progress_rows if r["mastery_level"] == 1),
            "familiar": sum(1 for r in progress_rows if r["mastery_level"] == 2),
            "mastered": mastered_words,
        }

        today_logs = conn.execute(
            """
            SELECT COUNT(DISTINCT word_id) AS words_cnt,
                   COUNT(*) AS reviews_cnt,
                   SUM(is_correct) AS correct_cnt
            FROM study_logs
            WHERE user_id = ? AND study_date = ?
            """,
            (user_id, today_str),
        ).fetchone()

        studied_today = int(today_logs["words_cnt"] or 0)
        reviews_today = int(today_logs["reviews_cnt"] or 0)
        correct_today = int(today_logs["correct_cnt"] or 0)

        # Calculate 14-day daily trend
        start_date = (now_utc - timedelta(days=13)).strftime("%Y-%m-%d")
        trend_rows = conn.execute(
            """
            SELECT study_date,
                   COUNT(DISTINCT word_id) AS words_count,
                   COUNT(*) AS reviews_count,
                   SUM(is_correct) AS correct_count
            FROM study_logs
            WHERE user_id = ? AND study_date >= ?
            GROUP BY study_date
            ORDER BY study_date ASC
            """,
            (user_id, start_date),
        ).fetchall()
        trend_map = {r["study_date"]: dict(r) for r in trend_rows}

        daily_trend = []
        for offset in range(13, -1, -1):
            d = (now_utc - timedelta(days=offset)).strftime("%Y-%m-%d")
            item = trend_map.get(d, {"words_count": 0, "reviews_count": 0, "correct_count": 0})
            daily_trend.append(
                {
                    "date": d,
                    "label": d[5:],
                    "words_count": int(item["words_count"] or 0),
                    "reviews_count": int(item["reviews_count"] or 0),
                    "correct_count": int(item["correct_count"] or 0),
                }
            )

        # Calculate current streak
        all_dates_rows = conn.execute(
            """
            SELECT DISTINCT study_date
            FROM study_logs
            WHERE user_id = ?
            ORDER BY study_date DESC
            """,
            (user_id,),
        ).fetchall()
        studied_dates = {r["study_date"] for r in all_dates_rows}
        streak = 0
        cursor_date = now_utc.date()
        if cursor_date.strftime("%Y-%m-%d") not in studied_dates:
            cursor_date = cursor_date - timedelta(days=1)
        while cursor_date.strftime("%Y-%m-%d") in studied_dates:
            streak += 1
            cursor_date = cursor_date - timedelta(days=1)

    return {
        "total_words": total_words,
        "learned_words": learned_words,
        "mastered_words": mastered_words,
        "mistake_count": mistake_count,
        "due_count": due_count,
        "studied_today": studied_today,
        "reviews_today": reviews_today,
        "accuracy_today": round((correct_today / reviews_today) * 100) if reviews_today > 0 else 0,
        "daily_goal": current_user["daily_goal"],
        "streak_days": streak,
        "mastery_distribution": mastery_dist,
        "daily_trend": daily_trend,
    }
